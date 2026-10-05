"""/api/sdks — catalog: profile, capabilities, formats, output modes, live availability."""

from typing import Annotated

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from config.settings import get_settings
from core.errors import not_found
from core.security import current_user
from extractors.base import OUTPUT_META
from extractors.ocr import installed_languages
from extractors.profiles import CAPABILITY_LABELS, PROFILES, overall_score
from extractors.registry import SDK_ORDER, build_registry, supported_kinds

router = APIRouter(prefix="/sdks", tags=["sdks"], dependencies=[Depends(current_user)])


def _describe(name: str) -> dict:
    settings = get_settings()
    extractor = build_registry(settings.tika_url)[name]
    profile = PROFILES[name]
    available, note = extractor.availability()
    return {
        "name": name,
        **{k: v for k, v in profile.items() if k != "capabilities"},
        "capabilities": [{"key": k, "label": CAPABILITY_LABELS[k], "value": v} for k, v in profile["capabilities"].items()],
        "overall": overall_score(profile["capabilities"]),
        "capability_source": "Editorial rating from SDK docs and public benchmarks",
        "version": extractor.version() if available else None,
        "available": available,
        "availability_note": note,
        "supported_kinds": supported_kinds(extractor),
        "output_formats": [{"id": f.value, **OUTPUT_META[f]} for f in extractor.output_formats()],
    }


@router.get("")
async def list_sdks() -> dict:
    items = [await run_in_threadpool(_describe, name) for name in SDK_ORDER]
    languages = await run_in_threadpool(installed_languages, get_settings().tesseract_cmd)
    return {"items": items, "ocr_languages": sorted(languages - {"osd"})}


@router.get("/{name}")
async def get_sdk(name: Annotated[str, "SDK name"]) -> dict:
    if name not in PROFILES:
        raise not_found("SDK")
    return await run_in_threadpool(_describe, name)
