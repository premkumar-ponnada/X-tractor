"""Download the AI models Docling and Unstructured need, once, before the first job.

    python scripts/prepare_models.py              # download + warm-up
    python scripts/prepare_models.py --no-warmup  # download only (Docker build)

Without this, the first PDF run downloads ~1 GB of models and can hit the run timeout.
Also warms a tiny conversion so libraries are compiled/cached. Safe to run again.
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252

FIXTURE = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "af-text.pdf"


def step(title: str, fn) -> None:
    started = time.perf_counter()
    print(f"→ {title} …", flush=True)
    fn()
    print(f"  done in {time.perf_counter() - started:.1f} s", flush=True)


def docling_models() -> None:
    from docling.utils.model_downloader import download_models

    # OCR runs through Tesseract, so RapidOCR's models (hosted on modelscope.cn) are not needed.
    # DOCLING_ARTIFACTS_PATH (set in Docker) makes Docling load from the same folder at runtime.
    target = os.environ.get("DOCLING_ARTIFACTS_PATH")
    download_models(output_dir=Path(target) if target else None, progress=True, with_code_formula=False, with_rapidocr=False)


def unstructured_models() -> None:
    from unstructured_inference.models.base import get_model

    get_model()  # default hi_res layout model


def warm_up() -> None:
    if not FIXTURE.exists():
        from tests.make_fixtures import main

        main()
    from docling.document_converter import DocumentConverter

    DocumentConverter().convert(FIXTURE)


if __name__ == "__main__":
    # --only docling|unstructured lets the Dockerfile cache each download in its own layer.
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    if only in (None, "docling"):
        step("Docling layout, table and picture models", docling_models)
    if only in (None, "unstructured"):
        step("Unstructured hi_res layout model", unstructured_models)
    if only is None and "--no-warmup" not in sys.argv:
        step("Warm-up conversion", warm_up)
    print("Models are ready.")
