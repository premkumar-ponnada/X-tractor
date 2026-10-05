"""Microsoft MarkItDown: everything to one Markdown string.

No page boundaries (except PowerPoint slide markers), no OCR without an LLM — kept honest
in the result so the comparison shows it.
"""

import re
from pathlib import Path

from extractors.base import (
    EmitFn,
    ExtractionError,
    ExtractionResult,
    ExtractOptions,
    FileKind,
    OutputFormat,
    Page,
    package_version,
)

KINDS = {
    FileKind.PDF,
    FileKind.DOCX,
    FileKind.XLSX,
    FileKind.XLS,
    FileKind.PPTX,
    FileKind.HTML,
    FileKind.TXT,
    FileKind.CSV,
    FileKind.MD,
    FileKind.MSG,
    FileKind.EPUB,
    FileKind.XML,
    FileKind.IMAGE,
}
PAGED_KINDS = {FileKind.PDF, FileKind.PPTX}
SLIDE_MARKER = re.compile(r"<!-- Slide number: (\d+) -->")
TABLE_SEPARATOR = re.compile(r"^\|\s*:?-{3,}", re.MULTILINE)

_converter = None


def _get_converter():
    global _converter
    if _converter is None:
        from markitdown import MarkItDown

        _converter = MarkItDown(enable_plugins=False)
    return _converter


def _count_tables(markdown: str) -> int:
    return len(TABLE_SEPARATOR.findall(markdown))


class MarkItDownExtractor:
    name = "markitdown"

    def version(self) -> str | None:
        return package_version("markitdown")

    def supports(self, kind: FileKind) -> bool:
        return kind in KINDS

    def output_formats(self) -> list[OutputFormat]:
        return [OutputFormat.MARKDOWN]

    def availability(self) -> tuple[bool, str]:
        if package_version("markitdown") is None:
            return False, "markitdown is not installed"
        return True, "Ready"

    def extract(self, path: Path, kind: FileKind, opts: ExtractOptions, emit: EmitFn) -> ExtractionResult:
        emit("parse", "Converting to Markdown", None)
        try:
            result = _get_converter().convert(str(path))
        except Exception as exc:
            raise ExtractionError(f"MarkItDown could not convert the file: {exc}") from exc
        markdown = getattr(result, "markdown", None) or result.text_content or ""
        warnings: list[str] = []
        page_fidelity = True

        if kind == FileKind.PPTX and SLIDE_MARKER.search(markdown):
            chunks = SLIDE_MARKER.split(markdown)
            pages = [
                Page(n=int(chunks[i]), text=chunks[i + 1].strip(), tables=_count_tables(chunks[i + 1]))
                for i in range(1, len(chunks) - 1, 2)
            ]
        else:
            pages = [Page(n=1, text=markdown, tables=_count_tables(markdown))]
            if kind in PAGED_KINDS:
                page_fidelity = False
                warnings.append("MarkItDown does not keep page boundaries — the whole document is returned as one page")
        if kind == FileKind.IMAGE:
            warnings.append("Images need an LLM client for OCR/description in MarkItDown — only metadata extracted")
        if opts.ocr and kind == FileKind.PDF:
            warnings.append("MarkItDown has no built-in OCR — scanned pages stay empty")

        return ExtractionResult(
            pages=pages,
            outputs={OutputFormat.MARKDOWN: markdown},
            warnings=warnings,
            metadata={"title": getattr(result, "title", None)},
            page_fidelity=page_fidelity,
        )
