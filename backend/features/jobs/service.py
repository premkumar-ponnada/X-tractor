"""Job use cases for the API: create (upload), read, list, cancel, retry, delete."""

import asyncio
import logging
from pathlib import Path

from fastapi import UploadFile

from config.settings import get_settings
from core.errors import AppError, bad_request, not_found
from core.storage import get_storage
from extractors.registry import SDK_ORDER
from features.jobs.models import (
    FINISHED_JOB,
    Job,
    JobFile,
    JobOptions,
    JobStatus,
    public_job,
    public_run,
    utcnow,
)
from features.jobs.repository import JobRepository

log = logging.getLogger("jobs")
MAX_NAME = 200


def parse_sdks(raw: str) -> list[str]:
    chosen = [s.strip().lower() for s in raw.split(",") if s.strip()]
    unknown = [s for s in chosen if s not in SDK_ORDER]
    if unknown:
        raise bad_request(f"Unknown SDK: {', '.join(unknown)}")
    if not chosen:
        raise bad_request("Choose at least one SDK")
    return [s for s in SDK_ORDER if s in chosen]  # stable order, no duplicates


def _safe_name(name: str | None) -> str:
    name = Path(name or "file").name.strip() or "file"
    return name[:MAX_NAME]


async def create_job(
    repo: JobRepository, *, files: list[UploadFile], sdks: list[str], options: JobOptions, name: str | None, owner: str
) -> dict:
    settings = get_settings()
    if not files:
        raise bad_request("Add at least one file")
    if len(files) > settings.max_files_per_job:
        raise bad_request(f"Too many files (limit {settings.max_files_per_job})")

    storage = get_storage()
    job = Job(name="", sdks=sdks, options=options, files=[], owner=owner)
    saved: list[JobFile] = []
    try:
        for upload in files:
            original = _safe_name(upload.filename)
            ext = Path(original).suffix.lower()[:12]
            item = JobFile(name=original, ext=ext, size=0)
            dest = storage.file_path(job.id, item.id, ext)
            item.size = await asyncio.to_thread(storage.save_stream, dest, upload.file, settings.max_file_bytes)
            if item.size == 0:
                dest.unlink(missing_ok=True)
                raise bad_request(f"{original} is empty")
            saved.append(item)
    except AppError:
        storage.delete_job(job.id)
        raise

    job.files = saved
    job.name = (name or "").strip()[:MAX_NAME] or (
        saved[0].name if len(saved) == 1 else f"{saved[0].name} + {len(saved) - 1} more"
    )
    await repo.insert_job(job.to_mongo())
    await repo.add_event(
        job.id,
        type="job.created",
        level="info",
        message=f"Job created with {len(saved)} file(s) and {len(sdks)} SDK(s)",
        data={"sdks": sdks, "options": options.model_dump(include={"ocr", "ocr_languages", "tables"})},
    )
    for item in saved:
        await repo.add_event(
            job.id,
            type="file.received",
            message=f"Received {item.name}",
            file_id=item.id,
            file_name=item.name,
            data={"size": item.size},
        )
    await repo.add_event(job.id, type="job.queued", message="Waiting for a worker")
    log.info("job created", extra={"job_id": job.id, "files": len(saved), "sdks": sdks})
    return public_job(job.to_mongo())


async def job_detail(repo: JobRepository, job_id: str) -> dict:
    job = await repo.get_job(job_id)
    if job is None:
        raise not_found("Job")
    runs = await repo.runs_for_job(job_id)
    detail = public_job(job)
    detail["runs"] = [public_run(r) for r in runs]
    detail["run_counts"] = await repo.run_counts(job_id)
    return detail


async def list_jobs(repo: JobRepository, *, page: int, page_size: int, status: str | None, search: str | None) -> dict:
    items, total = await repo.list_jobs(skip=(page - 1) * page_size, limit=page_size, status=status, search=search)
    result = []
    for job in items:
        summary = public_job(job)
        summary["run_counts"] = await repo.run_counts(job["_id"])
        summary["file_count"] = len([f for f in job.get("files", []) if not f.get("container")])
        summary.pop("files", None)
        result.append(summary)
    return {"items": result, "total": total, "page": page, "page_size": page_size}


async def cancel_job(repo: JobRepository, job_id: str) -> dict:
    job = await repo.get_job(job_id)
    if job is None:
        raise not_found("Job")
    if job["status"] in FINISHED_JOB:
        raise bad_request("Job has already finished")
    if job["status"] == JobStatus.QUEUED:
        await repo.update_job(job_id, {"status": JobStatus.CANCELLED, "finished_at": utcnow(), "cancel_requested": True})
        await repo.add_event(job_id, type="job.cancelled", level="warning", message="Cancelled before it started")
    else:
        await repo.update_job(job_id, {"cancel_requested": True})
        await repo.add_event(
            job_id, type="job.cancelling", level="warning", message="Cancel requested — stopping after the current run"
        )
    return await job_detail(repo, job_id)


async def retry_job(repo: JobRepository, job_id: str) -> dict:
    job = await repo.get_job(job_id)
    if job is None:
        raise not_found("Job")
    if job["status"] not in FINISHED_JOB:
        raise bad_request("Job is still running")
    reset = await repo.reset_failed_runs(job_id)
    has_runs = bool(await repo.runs_for_job(job_id))
    if has_runs and reset == 0:
        raise bad_request("Nothing to retry — every run succeeded or was unsupported")
    await repo.update_job(
        job_id,
        {
            "status": JobStatus.QUEUED,
            "finished_at": None,
            "error": None,
            "cancel_requested": False,
            "attempts": 0,
            "worker_id": None,
        },
    )
    await repo.add_event(
        job_id, type="job.retry", level="info", message=f"Retrying {reset} run(s)" if has_runs else "Retrying job"
    )
    return await job_detail(repo, job_id)


async def delete_job(repo: JobRepository, job_id: str) -> None:
    job = await repo.get_job(job_id)
    if job is None:
        raise not_found("Job")
    if job["status"] == JobStatus.RUNNING:
        raise bad_request("Cancel the job before deleting it")
    await repo.delete_job(job_id)
    await asyncio.to_thread(get_storage().delete_job, job_id)
