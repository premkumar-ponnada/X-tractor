"""Code that runs inside the extraction child processes.

Each child keeps its SDK objects (e.g. Docling's loaded models) between runs.
Never raises: always returns a plain dict the parent can store.
"""

import time
import traceback
from pathlib import Path
from typing import Any

from extractors.base import ExtractionError, ExtractOptions, FileKind
from extractors.libreoffice import ensure_on_path
from extractors.registry import build_registry

_registry = None


def execute_run(sdk: str, path: str, kind: str, options: dict[str, Any], events) -> dict[str, Any]:
    global _registry
    if _registry is None:
        ensure_on_path()  # Docling/Unstructured run `soffice` for legacy Office formats
        _registry = build_registry(options["tika_url"])
    extractor = _registry[sdk]

    def emit(stage: str, message: str, data: dict[str, Any] | None = None) -> None:
        try:
            events.put({"stage": stage, "message": message, "data": data})
        except Exception:
            pass  # progress is best effort

    started = time.perf_counter()
    try:
        result = extractor.extract(Path(path), FileKind(kind), ExtractOptions(**options), emit)
    except ExtractionError as exc:
        return {"ok": False, "error": str(exc), "duration_ms": _ms(started)}
    except MemoryError:
        return {"ok": False, "error": "Ran out of memory", "duration_ms": _ms(started)}
    except Exception as exc:
        return {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}"[:2000],
            "trace": traceback.format_exc()[-6000:],
            "duration_ms": _ms(started),
        }
    try:
        version = extractor.version()
    except Exception:
        version = None
    return {"ok": True, "duration_ms": _ms(started), "version": version, "result": result.model_dump(mode="json")}


def _ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)
