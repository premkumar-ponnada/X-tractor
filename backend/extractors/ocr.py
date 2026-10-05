"""Tesseract language discovery, shared by the SDKs that use it."""

import shutil
import subprocess
from functools import lru_cache


@lru_cache(maxsize=4)
def installed_languages(tesseract_cmd: str) -> frozenset[str]:
    exe = shutil.which(tesseract_cmd) or tesseract_cmd
    try:
        output = subprocess.run([exe, "--list-langs"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.TimeoutExpired):
        return frozenset()
    return frozenset(line.strip() for line in output.splitlines()[1:] if line.strip())


def usable_languages(requested: str, tesseract_cmd: str) -> tuple[list[str], list[str]]:
    """Split 'swe+eng' into (available, missing) against what Tesseract has installed."""
    wanted = [lang for lang in requested.split("+") if lang]
    have = installed_languages(tesseract_cmd)
    available = [lang for lang in wanted if lang in have]
    missing = [lang for lang in wanted if lang not in have]
    if not available and "eng" in have:
        available = ["eng"]
    return available, missing
