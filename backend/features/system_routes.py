"""/api/health — liveness of the API and its dependencies (no secrets, no config details)."""

from datetime import timedelta

import httpx
from fastapi import APIRouter

from config.settings import get_settings
from core.db import get_db
from features.jobs.repository import JobRepository

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    settings = get_settings()
    checks: dict[str, bool] = {}
    try:
        await get_db().command("ping")
        checks["database"] = True
    except Exception:
        checks["database"] = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            checks["tika"] = (await client.get(f"{settings.tika_url.rstrip('/')}/version")).is_success
    except httpx.HTTPError:
        checks["tika"] = False
    workers = 0
    if checks["database"]:
        workers = len(await JobRepository(get_db()).live_workers(timedelta(seconds=settings.worker_stale_seconds)))
    checks["worker"] = workers > 0
    return {"ok": checks["database"], "checks": checks, "workers": workers}
