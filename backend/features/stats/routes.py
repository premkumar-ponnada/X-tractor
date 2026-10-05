"""/api/stats — dashboard KPIs and measured per-SDK numbers across all runs."""

from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends

from config.settings import get_settings
from core.db import get_db
from core.security import current_user
from extractors.profiles import PROFILES
from extractors.registry import SDK_ORDER
from features.jobs.models import public_job
from features.jobs.repository import JobRepository

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[Depends(current_user)])


def _sdk_stats(runs: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for run in runs:
        grouped[run["sdk"]].append(run)
    result = []
    for sdk in SDK_ORDER:
        sdk_runs = grouped.get(sdk, [])
        done = [r for r in sdk_runs if r["status"] == "completed"]
        attempted = [r for r in sdk_runs if r["status"] in ("completed", "failed")]
        pages = sum(r["metrics"].get("pages", 0) for r in done)
        seconds = sum(r["metrics"].get("duration_ms", 0) for r in done) / 1000
        by_kind: dict[str, dict[str, int]] = defaultdict(lambda: {"completed": 0, "failed": 0})
        for run in attempted:
            by_kind[run.get("file_kind") or "other"][run["status"]] += 1
        result.append(
            {
                "sdk": sdk,
                "display_name": PROFILES[sdk]["display_name"],
                "color": PROFILES[sdk]["color"],
                "runs": len(sdk_runs),
                "completed": len(done),
                "failed": len(attempted) - len(done),
                "success_rate": round(100 * len(done) / len(attempted), 1) if attempted else None,
                "pages": pages,
                "pages_per_second": round(pages / seconds, 2) if seconds else None,
                "avg_coverage": round(sum(r["metrics"].get("text_coverage_pct", 0) for r in done) / len(done), 1)
                if done
                else None,
                "avg_duration_ms": round(1000 * seconds / len(done)) if done else None,
                "tables": sum(r["metrics"].get("tables", 0) for r in done),
                "by_kind": dict(by_kind),
            }
        )
    return result


@router.get("/sdks")
async def sdk_stats() -> list[dict]:
    return _sdk_stats(await JobRepository(get_db()).all_runs())


@router.get("/overview")
async def overview() -> dict:
    repository = JobRepository(get_db())
    runs = await repository.all_runs()
    counts = await repository.job_counts()
    done = [r for r in runs if r["status"] == "completed"]
    attempted = [r for r in runs if r["status"] in ("completed", "failed")]
    recent = [public_job(j) for j in await repository.recent_jobs(6)]
    for job in recent:
        job["file_count"] = len([f for f in job.pop("files", []) if not f.get("container")])
    workers = await repository.live_workers(timedelta(seconds=get_settings().worker_stale_seconds))
    return {
        "jobs": sum(counts.values()),
        "jobs_by_status": counts,
        "runs": len(runs),
        "pages": sum(r["metrics"].get("pages", 0) for r in done),
        "success_rate": round(100 * len(done) / len(attempted), 1) if attempted else None,
        "workers_online": len(workers),
        "recent_jobs": recent,
        "sdks": _sdk_stats(runs),
    }
