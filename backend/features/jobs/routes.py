"""/api/jobs — upload, list, detail, cancel, retry, delete, live events (SSE)."""

import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import Response
from sse_starlette.sse import EventSourceResponse

from core.db import get_db
from core.errors import not_found
from core.security import User, current_user
from features.jobs import service
from features.jobs.models import FINISHED_JOB, JobOptions, JobStatus, public_event
from features.jobs.repository import JobRepository

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(current_user)])
EVENT_POLL_SECONDS = 0.5
SSE_PING_SECONDS = 15


def repo() -> JobRepository:
    return JobRepository(get_db())


Repo = Annotated[JobRepository, Depends(repo)]


@router.post("", status_code=202)
async def create_job(
    repository: Repo,
    user: Annotated[User, Depends(current_user)],
    files: Annotated[list[UploadFile], File(description="Files to extract")],
    sdks: Annotated[str, Form(description="Comma-separated SDK names")],
    ocr: Annotated[bool, Form()] = True,
    tables: Annotated[bool, Form()] = True,
    ocr_languages: Annotated[str, Form(pattern=r"^[a-z_]{3,8}(\+[a-z_]{3,8}){0,4}$")] = "swe+eng",
    name: Annotated[str | None, Form(max_length=200)] = None,
) -> dict:
    options = JobOptions(ocr=ocr, tables=tables, ocr_languages=ocr_languages)
    return await service.create_job(
        repository, files=files, sdks=service.parse_sdks(sdks), options=options, name=name, owner=user.email
    )


@router.get("")
async def list_jobs(
    repository: Repo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: JobStatus | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> dict:
    return await service.list_jobs(repository, page=page, page_size=page_size, status=status, search=search)


@router.get("/{job_id}")
async def get_job(job_id: str, repository: Repo) -> dict:
    return await service.job_detail(repository, job_id)


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, repository: Repo) -> dict:
    return await service.cancel_job(repository, job_id)


@router.post("/{job_id}/retry")
async def retry_job(job_id: str, repository: Repo) -> dict:
    return await service.retry_job(repository, job_id)


@router.delete("/{job_id}", status_code=204)
async def delete_job(job_id: str, repository: Repo) -> Response:
    await service.delete_job(repository, job_id)
    return Response(status_code=204)


@router.get("/{job_id}/events")
async def stream_events(job_id: str, request: Request, repository: Repo) -> EventSourceResponse:
    """Server-sent events. Resumes after Last-Event-ID; closes once the job finished and is drained."""
    if await repository.get_job(job_id) is None:
        raise not_found("Job")
    try:
        last_seq = int(request.headers.get("last-event-id") or request.query_params.get("after") or 0)
    except ValueError:
        last_seq = 0

    async def generator():
        nonlocal last_seq
        while not await request.is_disconnected():
            events = await repository.events_after(job_id, last_seq)
            for event in events:
                last_seq = event["seq"]
                yield {"id": str(last_seq), "event": "job_event", "data": json.dumps(public_event(event), default=str)}
            if not events:
                job = await repository.get_job(job_id)
                if job is None or job["status"] in FINISHED_JOB:
                    yield {"event": "end", "data": json.dumps({"status": job["status"] if job else "deleted"})}
                    return
                await asyncio.sleep(EVENT_POLL_SECONDS)

    return EventSourceResponse(generator(), ping=SSE_PING_SECONDS, headers={"X-Accel-Buffering": "no"})


@router.get("/{job_id}/events/history")
async def event_history(job_id: str, repository: Repo, after: Annotated[int, Query(ge=0)] = 0) -> list[dict]:
    if await repository.get_job(job_id) is None:
        raise not_found("Job")
    return [public_event(e) for e in await repository.events_after(job_id, after, limit=2000)]
