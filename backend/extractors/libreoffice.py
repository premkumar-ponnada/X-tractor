"""Find LibreOffice and make sure `soffice` is on PATH for the SDKs that shell out to it.

Docling and Unstructured convert .doc/.xls/.ppt/.rtf by running `soffice` from PATH, but the
Windows installer does not add LibreOffice to PATH. We look in the usual install folders
(or XT_LIBREOFFICE_DIR) and prepend the folder for this process and its children.
"""

import os
import shutil
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

CANDIDATES = (
    r"C:\Program Files\LibreOffice\program",
    r"C:\Program Files (x86)\LibreOffice\program",
    "/usr/bin",
    "/usr/lib/libreoffice/program",
    "/Applications/LibreOffice.app/Contents/MacOS",
)


@lru_cache(maxsize=1)
def libreoffice_dir() -> Path | None:
    configured = os.environ.get("XT_LIBREOFFICE_DIR")
    for folder in ([configured] if configured else []) + list(CANDIDATES):
        for exe in ("soffice.exe", "soffice"):
            if (Path(folder) / exe).is_file():
                return Path(folder)
    found = shutil.which("soffice") or shutil.which("libreoffice")
    return Path(found).parent if found else None


def ensure_on_path() -> bool:
    """Prepend LibreOffice's folder to PATH if needed. Returns True when soffice is usable."""
    if shutil.which("soffice"):
        return True
    folder = libreoffice_dir()
    if folder is None:
        return False
    os.environ["PATH"] = f"{folder}{os.pathsep}{os.environ.get('PATH', '')}"
    return shutil.which("soffice") is not None


def libreoffice_available() -> bool:
    return ensure_on_path()


MODERN = {".doc": "docx", ".dot": "docx", ".rtf": "docx", ".odt": "docx", ".xls": "xlsx", ".ppt": "pptx"}
CONVERT_TIMEOUT = 180


def convert_to_modern(path: Path, out_dir: Path) -> Path:
    """Convert a legacy Office/RTF file with LibreOffice headless (e.g. .doc → .docx).

    Uses a private LibreOffice profile so it works while LibreOffice is open on the desktop
    and when several worker processes convert at the same time.
    """
    target = MODERN.get(path.suffix.lower())
    if target is None:
        raise ValueError(f"No modern format for {path.suffix}")
    if not ensure_on_path():
        raise RuntimeError("LibreOffice is not installed")
    out_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="xt-lo-profile-") as profile:
        try:
            result = subprocess.run(
                [
                    shutil.which("soffice"),
                    f"-env:UserInstallation={Path(profile).as_uri()}",
                    "--headless",
                    "--convert-to",
                    target,
                    "--outdir",
                    str(out_dir),
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=CONVERT_TIMEOUT,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"LibreOffice conversion timed out after {CONVERT_TIMEOUT} s") from exc
    converted = out_dir / f"{path.stem}.{target}"
    if result.returncode != 0 or not converted.exists():
        raise RuntimeError(f"LibreOffice could not convert the file: {(result.stderr or result.stdout).strip()[:300]}")
    return converted
