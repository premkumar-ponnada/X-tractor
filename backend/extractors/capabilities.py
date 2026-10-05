"""What this machine can extract: SDK availability/versions, OCR languages, LibreOffice.

The worker reports this in its heartbeat; the API shows the worker's view, because in
production the API container has no SDKs, OCR or LibreOffice of its own.
"""

from typing import Any

from extractors.libreoffice import libreoffice_available
from extractors.ocr import installed_languages
from extractors.registry import SDK_ORDER, build_registry


def collect(tika_url: str, tesseract_cmd: str) -> dict[str, Any]:
    registry = build_registry(tika_url)
    sdks = {}
    for name in SDK_ORDER:
        extractor = registry[name]
        available, note = extractor.availability()
        sdks[name] = {"available": available, "note": note, "version": extractor.version() if available else None}
    return {
        "sdks": sdks,
        "ocr_languages": sorted(installed_languages(tesseract_cmd) - {"osd"}),
        "libreoffice": libreoffice_available(),
    }
