"""/api/runs and job-level comparisons: pages, output formats, downloads, compare, report."""

import asyncio
from collections import defaultdict
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from core.db import get_db
from core.errors import bad_request, not_found
from core.security import current_user
from core.storage import get_storage
from extractors.base import OUTPUT_META, OutputFormat
from extractors.profiles import PROFILES
from features.jobs.models import public_run
from features.jobs.repository import JobRepository
from features.results.scoring import WEIGHT_LABELS, WEIGHTS, score_file_runs

router = APIRouter(tags=["results"], dependencies=[Depends(current_user)])
PREVIEW_LIMIT = 2_000_000  # characters returned inline; larger outputs are download-only


def repo() -> JobRepository:
    return JobRepository(get_db())


Repo = Annotated[JobRepository, Depends(repo)]


async def _run_or_404(repository: JobRepository, run_id: str) -> dict:
    run = await repository.get_run(run_id)
    if run is None:
        raise not_found("Run")
    return run


def _format_or_400(run: dict, fmt: str) -> OutputFormat:
    if fmt not in run.get("output_formats", []):
        raise bad_request(f"{run['sdk']} has no '{fmt}' output for this run", {"available": run.get("output_formats", [])})
    return OutputFormat(fmt)


@router.get("/runs/{run_id}")
async def get_run(run_id: str, repository: Repo) -> dict:
    run = public_run(await _run_or_404(repository, run_id))
    run["formats"] = [{"id": f, **OUTPUT_META[OutputFormat(f)]} for f in run.get("output_formats", [])]
    return run


@router.get("/runs/{run_id}/pages")
async def get_pages(
    run_id: str,
    repository: Repo,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict:
    run = await _run_or_404(repository, run_id)
    pages = await asyncio.to_thread(get_storage().read_pages, run["job_id"], run_id)
    return {"total": len(pages), "offset": offset, "items": pages[offset : offset + limit]}


@router.get("/runs/{run_id}/output")
async def get_output(run_id: str, repository: Repo, format: Annotated[str, Query()]) -> dict:
    run = await _run_or_404(repository, run_id)
    fmt = _format_or_400(run, format)
    content = await asyncio.to_thread(get_storage().read_run_output, run["job_id"], run_id, fmt.value)
    if content is None:
        raise not_found("Output")
    truncated = len(content) > PREVIEW_LIMIT
    return {
        "format": fmt.value,
        **OUTPUT_META[fmt],
        "size": len(content),
        "truncated": truncated,
        "content": content[:PREVIEW_LIMIT],
    }


@router.get("/runs/{run_id}/download")
async def download_output(run_id: str, repository: Repo, format: Annotated[str, Query()]) -> Response:
    run = await _run_or_404(repository, run_id)
    fmt = _format_or_400(run, format)
    content = await asyncio.to_thread(get_storage().read_run_output, run["job_id"], run_id, fmt.value)
    if content is None:
        raise not_found("Output")
    meta = OUTPUT_META[fmt]
    stem = run["file_name"].rsplit(".", 1)[0]
    filename = f"{stem}.{run['sdk']}.{meta['ext']}"
    return Response(
        content.encode("utf-8"),
        media_type=f"{meta['mime']}; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/jobs/{job_id}/compare")
async def compare(job_id: str, repository: Repo, file_id: Annotated[str, Query()]) -> dict:
    if await repository.get_job(job_id) is None:
        raise not_found("Job")
    runs = await repository.runs_for_job(job_id, file_id)
    scores = score_file_runs(runs)
    return {"file_id": file_id, "runs": [{**public_run(r), "score": scores.get(r["_id"])} for r in runs]}


@router.get("/jobs/{job_id}/report")
async def report(job_id: str, repository: Repo) -> dict:
    job = await repository.get_job(job_id)
    if job is None:
        raise not_found("Job")
    runs = await repository.runs_for_job(job_id)
    by_file: dict[str, list[dict]] = defaultdict(list)
    for run in runs:
        by_file[run["file_id"]].append(run)

    files, sdk_scores = [], defaultdict(list)
    for file_id, file_runs in by_file.items():
        scores = score_file_runs(file_runs)
        ranked = sorted(scores.items(), key=lambda kv: kv[1]["score"], reverse=True)
        winner = next((r for r in file_runs if ranked and r["_id"] == ranked[0][0]), None)
        for run in file_runs:
            if run["_id"] in scores:
                sdk_scores[run["sdk"]].append(scores[run["_id"]]["score"])
        files.append(
            {
                "file_id": file_id,
                "file_name": file_runs[0]["file_name"],
                "file_kind": file_runs[0].get("file_kind"),
                "winner": winner["sdk"] if winner else None,
                "runs": [
                    {
                        "run_id": r["_id"],
                        "sdk": r["sdk"],
                        "status": r["status"],
                        "metrics": r.get("metrics", {}),
                        "error": r.get("error"),
                        "score": scores.get(r["_id"]),
                    }
                    for r in file_runs
                ],
            }
        )

    sdks = []
    for sdk in job["sdks"]:
        sdk_runs = [r for r in runs if r["sdk"] == sdk]
        done = [r for r in sdk_runs if r["status"] == "completed"]
        total_ms = sum(r.get("metrics", {}).get("duration_ms", 0) for r in done)
        pages = sum(r.get("metrics", {}).get("pages", 0) for r in done)
        attempted = [r for r in sdk_runs if r["status"] != "unsupported"]
        sdks.append(
            {
                "sdk": sdk,
                "display_name": PROFILES[sdk]["display_name"],
                "color": PROFILES[sdk]["color"],
                "runs": len(sdk_runs),
                "completed": len(done),
                "failed": sum(1 for r in sdk_runs if r["status"] == "failed"),
                "unsupported": sum(1 for r in sdk_runs if r["status"] == "unsupported"),
                "success_rate": round(100 * len(done) / len(attempted), 1) if attempted else 0.0,
                "avg_score": round(sum(sdk_scores[sdk]) / len(sdk_scores[sdk]), 1) if sdk_scores[sdk] else None,
                "wins": sum(1 for f in files if f["winner"] == sdk),
                "total_ms": total_ms,
                "pages": pages,
                "avg_coverage": round(sum(r["metrics"].get("text_coverage_pct", 0) for r in done) / len(done), 1)
                if done
                else 0.0,
                "tables": sum(r.get("metrics", {}).get("tables", 0) for r in done),
            }
        )
    sdks.sort(key=lambda s: (s["avg_score"] is not None, s["avg_score"] or 0), reverse=True)
    return {
        "job_id": job_id,
        "status": job["status"],
        "weights": [{"key": k, "label": WEIGHT_LABELS[k], "weight": w} for k, w in WEIGHTS.items()],
        "sdks": sdks,
        "files": sorted(files, key=lambda f: f["file_name"].lower()),
    }
