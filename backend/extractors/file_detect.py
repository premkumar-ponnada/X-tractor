"""Detect the real file type from content (magic bytes), falling back to the extension."""

import zipfile
from pathlib import Path

import filetype

from extractors.base import FileKind

EXTENSION_KINDS: dict[str, FileKind] = {
    ".pdf": FileKind.PDF,
    ".docx": FileKind.DOCX,
    ".docm": FileKind.DOCX,
    ".dotx": FileKind.DOCX,
    ".doc": FileKind.DOC,
    ".dot": FileKind.DOC,
    ".xlsx": FileKind.XLSX,
    ".xlsm": FileKind.XLSX,
    ".xls": FileKind.XLS,
    ".pptx": FileKind.PPTX,
    ".ppt": FileKind.PPT,
    ".rtf": FileKind.RTF,
    ".odt": FileKind.ODT,
    ".ods": FileKind.ODS,
    ".odp": FileKind.ODP,
    ".txt": FileKind.TXT,
    ".text": FileKind.TXT,
    ".log": FileKind.TXT,
    ".csv": FileKind.CSV,
    ".tsv": FileKind.CSV,
    ".md": FileKind.MD,
    ".markdown": FileKind.MD,
    ".html": FileKind.HTML,
    ".htm": FileKind.HTML,
    ".xml": FileKind.XML,
    ".eml": FileKind.EML,
    ".msg": FileKind.MSG,
    ".epub": FileKind.EPUB,
    ".png": FileKind.IMAGE,
    ".jpg": FileKind.IMAGE,
    ".jpeg": FileKind.IMAGE,
    ".tif": FileKind.IMAGE,
    ".tiff": FileKind.IMAGE,
    ".bmp": FileKind.IMAGE,
    ".gif": FileKind.IMAGE,
    ".webp": FileKind.IMAGE,
    ".zip": FileKind.ZIP,
}

MIME_KINDS: dict[str, FileKind] = {
    "application/pdf": FileKind.PDF,
    "application/rtf": FileKind.RTF,
    "application/epub+zip": FileKind.EPUB,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileKind.DOCX,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileKind.XLSX,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": FileKind.PPTX,
    "application/vnd.oasis.opendocument.text": FileKind.ODT,
    "application/vnd.oasis.opendocument.spreadsheet": FileKind.ODS,
    "application/vnd.oasis.opendocument.presentation": FileKind.ODP,
}

OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # legacy .doc/.xls/.ppt/.msg container


def detect_kind(path: Path, original_name: str) -> tuple[FileKind, str | None]:
    """Return (kind, mime). Content wins over the extension when they disagree in a known way."""
    ext_kind = EXTENSION_KINDS.get(Path(original_name).suffix.lower(), FileKind.OTHER)
    guess = filetype.guess(str(path))
    mime = guess.mime if guess else None

    if mime:
        if mime.startswith("image/"):
            return FileKind.IMAGE, mime
        if mime in MIME_KINDS:
            return MIME_KINDS[mime], mime
        if mime == "application/zip":
            return _zip_family(path, ext_kind), mime

    with path.open("rb") as handle:
        head = handle.read(8)
    if head == OLE_SIGNATURE and ext_kind in {FileKind.DOC, FileKind.XLS, FileKind.PPT, FileKind.MSG}:
        return ext_kind, "application/x-ole-storage"
    if head.startswith(b"{\\rtf"):
        return FileKind.RTF, "application/rtf"
    if head.startswith(b"%PDF"):
        return FileKind.PDF, "application/pdf"
    return ext_kind, mime


def _zip_family(path: Path, ext_kind: FileKind) -> FileKind:
    """docx/xlsx/pptx/odt are zips too — look inside before calling it an archive."""
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
    except zipfile.BadZipFile:
        return ext_kind
    if "word/document.xml" in names:
        return FileKind.DOCX
    if "xl/workbook.xml" in names:
        return FileKind.XLSX
    if "ppt/presentation.xml" in names:
        return FileKind.PPTX
    if "mimetype" in names and ext_kind in {FileKind.ODT, FileKind.ODS, FileKind.ODP, FileKind.EPUB}:
        return ext_kind
    return FileKind.ZIP
