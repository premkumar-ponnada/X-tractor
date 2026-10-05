"""File storage behind a small interface: local disk now, Azure Blob later.

Layout:
  jobs/<job_id>/files/<file_id><ext>          uploaded and unpacked files
  jobs/<job_id>/runs/<run_id>/pages.json      normalised pages for a run
  jobs/<job_id>/runs/<run_id>/output.<fmt>    native SDK outputs
"""

import json
import shutil
from pathlib import Path
from typing import Any, BinaryIO

from config.settings import get_settings
from core.errors import AppError

CHUNK = 1024 * 1024


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _safe(self, *parts: str) -> Path:
        path = self.root.joinpath(*parts).resolve()
        if not path.is_relative_to(self.root):
            raise AppError(400, "bad_path", "Invalid storage path")
        return path

    def file_path(self, job_id: str, file_id: str, ext: str) -> Path:
        return self._safe("jobs", job_id, "files", f"{file_id}{ext}")

    def run_dir(self, job_id: str, run_id: str) -> Path:
        return self._safe("jobs", job_id, "runs", run_id)

    def save_stream(self, dest: Path, source: BinaryIO, max_bytes: int) -> int:
        """Copy in chunks and stop as soon as the limit is passed (never buffers the whole file)."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with dest.open("wb") as out:
            while chunk := source.read(CHUNK):
                written += len(chunk)
                if written > max_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise AppError(413, "file_too_large", f"File is larger than {max_bytes // (1024 * 1024)} MB")
                out.write(chunk)
        return written

    def write_run_output(self, job_id: str, run_id: str, fmt: str, content: str) -> Path:
        path = self.run_dir(job_id, run_id) / f"output.{fmt}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def read_run_output(self, job_id: str, run_id: str, fmt: str) -> str | None:
        path = self.run_dir(job_id, run_id) / f"output.{fmt}"
        return path.read_text(encoding="utf-8") if path.exists() else None

    def write_pages(self, job_id: str, run_id: str, pages: list[dict[str, Any]]) -> None:
        path = self.run_dir(job_id, run_id) / "pages.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")

    def read_pages(self, job_id: str, run_id: str) -> list[dict[str, Any]]:
        path = self.run_dir(job_id, run_id) / "pages.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []

    def delete_job(self, job_id: str) -> None:
        shutil.rmtree(self._safe("jobs", job_id), ignore_errors=True)


_storage: LocalStorage | None = None


def get_storage() -> LocalStorage:
    global _storage
    if _storage is None:
        _storage = LocalStorage(get_settings().storage_dir)
    return _storage
