"""/api/sdks — catalog: profile, capabilities, formats, output modes, live availability."""

from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from config.settings import get_settings
from core.db import get_db
from core.errors import not_found
from core.security import current_user
from extractors.base import OUTPUT_META
from extractors.capabilities import collect
from extractors.profiles import CAPABILITY_LABELS, PROFILES, overall_score
from extractors.registry import SDK_ORDER, build_registry, supported_kinds
from features.jobs.repository import JobRepository

router = APIRouter(prefix="/sdks", tags=["sdks"], dependencies=[Depends(current_user)])


async def _capabilities() -> tuple[dict[str, Any], str]:
    """The live worker's report if one is online (it is the machine that extracts), else a local check."""
    settings = get_settings()
    workers = await JobRepository(get_db()).live_workers(timedelta(seconds=settings.worker_stale_seconds))
    reported = next((w["capabilities"] for w in workers if w.get("capabilities")), None)
    if reported:
        return reported, "worker"
    return await run_in_threadpool(collect, settings.tika_url, settings.tesseract_cmd), "api"


def _describe(name: str, capabilities: dict[str, Any]) -> dict:
    extractor = build_registry(get_settings().tika_url)[name]
    profile = PROFILES[name]
    status = capabilities["sdks"][name]
    return {
        "name": name,
        **{k: v for k, v in profile.items() if k != "capabilities"},
        "capabilities": [{"key": k, "label": CAPABILITY_LABELS[k], "value": v} for k, v in profile["capabilities"].items()],
        "overall": overall_score(profile["capabilities"]),
        "capability_source": "Editorial rating from SDK docs and public benchmarks",
        "version": status["version"],
        "available": status["available"],
        "availability_note": status["note"],
        "supported_kinds": supported_kinds(extractor),
        "output_formats": [{"id": f.value, **OUTPUT_META[f]} for f in extractor.output_formats()],
    }


@router.get("")
async def list_sdks() -> dict:
    capabilities, source = await _capabilities()
    return {
        "items": [_describe(name, capabilities) for name in SDK_ORDER],
        "ocr_languages": capabilities["ocr_languages"],
        "libreoffice": capabilities["libreoffice"],
        "reported_by": source,
    }


@router.get("/{name}")
async def get_sdk(name: Annotated[str, "SDK name"]) -> dict:
    if name not in PROFILES:
        raise not_found("SDK")
    capabilities, _ = await _capabilities()
    return _describe(name, capabilities)
