"""Comparable quality score per run, relative to the other SDKs on the same file.

The weights are returned with every report so the UI can explain the score.
"""

from typing import Any

WEIGHTS = {
    "coverage": 0.30,  # % pages with real text
    "volume": 0.20,  # text found vs the best SDK on this file
    "pages": 0.15,  # page boundaries kept
    "tables": 0.15,  # tables found vs the best SDK on this file
    "encoding": 0.10,  # no broken å/ä/ö or replacement characters
    "speed": 0.10,  # vs the fastest SDK on this file
}
WEIGHT_LABELS = {
    "coverage": "Pages with text",
    "volume": "Text found",
    "pages": "Page numbers kept",
    "tables": "Tables found",
    "encoding": "Clean characters",
    "speed": "Speed",
}


def _relative(value: float, best: float) -> float:
    return 100.0 if best <= 0 else min(100.0, 100.0 * value / best)


def score_file_runs(runs: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """runs: completed runs of one file. Returns {run_id: {score, parts}}."""
    done = [r for r in runs if r.get("status") == "completed" and r.get("metrics")]
    if not done:
        return {}
    best_chars = max(r["metrics"].get("chars", 0) for r in done)
    best_tables = max(r["metrics"].get("tables", 0) for r in done)
    fastest = min(max(r["metrics"].get("duration_ms", 1), 1) for r in done)
    scored = {}
    for run in done:
        m = run["metrics"]
        parts = {
            "coverage": float(m.get("text_coverage_pct", 0)),
            "volume": _relative(m.get("chars", 0), best_chars),
            "pages": 100.0 if m.get("page_fidelity", True) else 0.0,
            "tables": _relative(m.get("tables", 0), best_tables),
            "encoding": max(0.0, 100.0 - 5.0 * m.get("encoding_errors", 0)),
            "speed": _relative(fastest, max(m.get("duration_ms", 1), 1)),
        }
        score = sum(WEIGHTS[k] * v for k, v in parts.items())
        scored[run["_id"]] = {"score": round(score, 1), "parts": {k: round(v, 1) for k, v in parts.items()}}
    return scored
