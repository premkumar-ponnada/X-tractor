"""Safe .zip unpacking: entry/size/ratio/depth limits, no path traversal, junk skipped."""

import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

SKIP_PARTS = ("__MACOSX",)


@dataclass(frozen=True)
class ZipLimits:
    max_entries: int
    max_total_bytes: int
    max_ratio: int


@dataclass
class ZipEntry:
    name: str  # path inside the archive, for display
    data: bytes


class ZipLimitError(Exception):
    pass


def _skip(name: str) -> bool:
    path = PurePosixPath(name)
    return any(p in SKIP_PARTS for p in path.parts) or path.name.startswith((".", "~$")) or not path.name


def iter_zip(path: Path, limits: ZipLimits) -> Iterator[ZipEntry]:
    """Yield file entries, checking all limits before reading anything.

    Raises ZipLimitError for archives that look like zip bombs.
    """
    with zipfile.ZipFile(path) as archive:
        infos = [i for i in archive.infolist() if not i.is_dir() and not _skip(i.filename)]
        if len(infos) > limits.max_entries:
            raise ZipLimitError(f"Archive has {len(infos)} files (limit {limits.max_entries})")
        total = sum(i.file_size for i in infos)
        if total > limits.max_total_bytes:
            raise ZipLimitError(
                f"Archive unpacks to {total // (1024 * 1024)} MB (limit {limits.max_total_bytes // (1024 * 1024)} MB)"
            )
        for info in infos:
            if info.compress_size and info.file_size / info.compress_size > limits.max_ratio:
                raise ZipLimitError(f"Suspicious compression ratio in {info.filename}")
        for info in infos:
            with archive.open(info) as member:
                data = member.read(info.file_size + 1)  # never decompress past the declared size
            if len(data) != info.file_size:  # header lied about the size
                raise ZipLimitError(f"Size mismatch in {info.filename}")
            yield ZipEntry(name=_display_name(info), data=data)


def _display_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if not info.flag_bits & 0x800:  # not flagged UTF-8: old Windows zips use cp437 → try cp850/cp1252
        try:
            raw = name.encode("cp437")
            for codec in ("utf-8", "cp850", "cp1252"):
                try:
                    return raw.decode(codec)
                except UnicodeDecodeError:
                    continue
        except UnicodeEncodeError:
            pass
    return name
