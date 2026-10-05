"""The one contract every extraction SDK adapter implements.

Adapters run inside worker child processes, so everything here must be picklable.
Pages follow DACO's page model: [{n, text}], plus tables/images counts per page.
"""

from collections.abc import Callable
from enum import StrEnum
from pathlib import Path
from typing import Any, Protocol

from pydantic import BaseModel, Field


class OutputFormat(StrEnum):
    MARKDOWN = "markdown"
    JSON = "json"
    HTML = "html"
    TEXT = "text"
    DOCTAGS = "doctags"
    XHTML = "xhtml"
    METADATA = "metadata"


OUTPUT_META: dict[OutputFormat, dict[str, str]] = {
    OutputFormat.MARKDOWN: {"label": "Markdown", "ext": "md", "mime": "text/markdown"},
    OutputFormat.JSON: {"label": "JSON", "ext": "json", "mime": "application/json"},
    OutputFormat.HTML: {"label": "HTML", "ext": "html", "mime": "text/html"},
    OutputFormat.TEXT: {"label": "Plain text", "ext": "txt", "mime": "text/plain"},
    OutputFormat.DOCTAGS: {"label": "DocTags", "ext": "doctags", "mime": "text/plain"},
    OutputFormat.XHTML: {"label": "XHTML", "ext": "xhtml", "mime": "application/xhtml+xml"},
    OutputFormat.METADATA: {"label": "Metadata JSON", "ext": "meta.json", "mime": "application/json"},
}


class FileKind(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    XLSX = "xlsx"
    XLS = "xls"
    PPTX = "pptx"
    PPT = "ppt"
    RTF = "rtf"
    ODT = "odt"
    ODS = "ods"
    ODP = "odp"
    TXT = "txt"
    CSV = "csv"
    MD = "md"
    HTML = "html"
    XML = "xml"
    EML = "eml"
    MSG = "msg"
    EPUB = "epub"
    IMAGE = "image"
    ZIP = "zip"
    OTHER = "other"


class ExtractOptions(BaseModel):
    ocr: bool = True
    ocr_languages: str = "swe+eng"
    tables: bool = True
    tika_url: str = "http://localhost:9998"
    tesseract_cmd: str = "tesseract"


class Page(BaseModel):
    n: int
    text: str
    tables: int = 0
    images: int = 0


class ExtractionResult(BaseModel):
    pages: list[Page]
    outputs: dict[OutputFormat, str]
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    page_fidelity: bool = True  # False when the SDK cannot keep page boundaries


# emit(stage, message, data) — progress events streamed to the UI timeline
EmitFn = Callable[[str, str, dict[str, Any] | None], None]


class Extractor(Protocol):
    name: str

    def version(self) -> str | None: ...

    def supports(self, kind: FileKind) -> bool: ...

    def output_formats(self) -> list[OutputFormat]: ...

    def availability(self) -> tuple[bool, str]: ...

    def extract(self, path: Path, kind: FileKind, opts: ExtractOptions, emit: EmitFn) -> ExtractionResult: ...


class ExtractionError(Exception):
    """Expected, user-facing extraction failure (corrupt file, missing service...)."""


def package_version(dist: str) -> str | None:
    from importlib.metadata import PackageNotFoundError, version

    try:
        return version(dist)
    except PackageNotFoundError:
        return None
