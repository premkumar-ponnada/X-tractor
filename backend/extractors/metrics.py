"""Measurements computed the same way for every SDK, so results are comparable."""

import re
from typing import Any

from extractors.base import Page

EMPTY_PAGE_CHARS = 25  # fewer visible characters than this counts as empty (likely scanned)
SWEDISH = re.compile(r"[åäöÅÄÖ]")
MOJIBAKE = re.compile(r"Ã[¥¤¶…„–]|�")  # å/ä/ö decoded with the wrong codec, or replacement chars
WORD = re.compile(r"\w+", re.UNICODE)


def compute_metrics(pages: list[Page], duration_ms: int, page_fidelity: bool) -> dict[str, Any]:
    texts = [p.text or "" for p in pages]
    visible = [len(t.strip()) for t in texts]
    page_count = len(pages)
    with_text = sum(1 for v in visible if v >= EMPTY_PAGE_CHARS)
    chars = sum(len(t) for t in texts)
    seconds = max(duration_ms / 1000, 0.001)
    return {
        "duration_ms": duration_ms,
        "pages": page_count,
        "pages_with_text": with_text,
        "empty_pages": [p.n for p, v in zip(pages, visible, strict=True) if v < EMPTY_PAGE_CHARS],
        "text_coverage_pct": round(100 * with_text / page_count, 1) if page_count else 0.0,
        "chars": chars,
        "words": sum(len(WORD.findall(t)) for t in texts),
        "tables": sum(p.tables for p in pages),
        "images": sum(p.images for p in pages),
        "swedish_chars": sum(len(SWEDISH.findall(t)) for t in texts),
        "encoding_errors": sum(len(MOJIBAKE.findall(t)) for t in texts),
        "pages_per_second": round(page_count / seconds, 2),
        "chars_per_second": round(chars / seconds),
        "page_fidelity": page_fidelity,
    }
