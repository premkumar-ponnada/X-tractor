"""Unstructured (open-source): partitions files into typed elements with page_number metadata."""

import html
import json
from collections import defaultdict
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
from extractors.libreoffice import libreoffice_available
from extractors.ocr import usable_languages

LEGACY_KINDS = {FileKind.DOC, FileKind.PPT, FileKind.ODT}
OCR_KINDS = {FileKind.PDF, FileKind.IMAGE}
KINDS = {
    FileKind.PDF,
    FileKind.DOCX,
    FileKind.XLSX,
    FileKind.XLS,
    FileKind.PPTX,
    FileKind.RTF,
    FileKind.HTML,
    FileKind.TXT,
    FileKind.CSV,
    FileKind.MD,
    FileKind.EML,
    FileKind.MSG,
    FileKind.IMAGE,
    FileKind.EPUB,
    FileKind.XML,
} | LEGACY_KINDS


def _element_markdown(element) -> str:
    category = getattr(element, "category", "")
    text = element.text or ""
    if category == "Title":
        return f"## {text}"
    if category == "ListItem":
        return f"- {text}"
    if category == "Table":
        return getattr(element.metadata, "text_as_html", None) or text
    return text


class UnstructuredExtractor:
    name = "unstructured"

    def version(self) -> str | None:
        return package_version("unstructured")

    def supports(self, kind: FileKind) -> bool:
        return kind in KINDS

    def output_formats(self) -> list[OutputFormat]:
        return [OutputFormat.JSON, OutputFormat.TEXT, OutputFormat.HTML, OutputFormat.MARKDOWN]

    def availability(self) -> tuple[bool, str]:
        if package_version("unstructured") is None:
            return False, "unstructured is not installed"
        return True, "Ready" if libreoffice_available() else "Ready (install LibreOffice for .doc/.ppt/.odt)"

    def extract(self, path: Path, kind: FileKind, opts: ExtractOptions, emit: EmitFn) -> ExtractionResult:
        from unstructured.partition.auto import partition
        from unstructured.staging.base import elements_to_json

        warnings: list[str] = []
        if kind in LEGACY_KINDS and not libreoffice_available():
            raise ExtractionError("This format needs LibreOffice, which is not installed")
        strategy = "hi_res" if opts.ocr and kind in OCR_KINDS else "fast"
        languages = ["eng"]
        if opts.ocr and kind in OCR_KINDS:
            available, missing = usable_languages(opts.ocr_languages, opts.tesseract_cmd)
            languages = available or ["eng"]
            if missing:
                warnings.append(f"Tesseract language data missing: {', '.join(missing)} — OCR used {'+'.join(languages)}")

        emit("parse", f"Partitioning with strategy '{strategy}'", {"strategy": strategy})
        try:
            elements = partition(
                filename=str(path),
                strategy=strategy,
                languages=languages,
                infer_table_structure=opts.tables,
                include_page_breaks=False,
            )
        except Exception as exc:
            raise ExtractionError(f"Unstructured could not partition the file: {exc}") from exc

        emit("export", f"Grouping {len(elements)} elements by page", {"elements": len(elements)})
        by_page: dict[int, list] = defaultdict(list)
        for element in elements:
            by_page[getattr(element.metadata, "page_number", None) or 1].append(element)
        pages = [
            Page(
                n=n,
                text="\n\n".join(_element_markdown(e) for e in by_page[n]),
                tables=sum(1 for e in by_page[n] if e.category == "Table"),
                images=sum(1 for e in by_page[n] if e.category in ("Image", "Figure")),
            )
            for n in sorted(by_page)
        ] or [Page(n=1, text="")]

        body = "\n".join(
            getattr(e.metadata, "text_as_html", None)
            if e.category == "Table" and getattr(e.metadata, "text_as_html", None)
            else f'<p data-type="{e.category}">{html.escape(e.text or "")}</p>'
            for e in elements
        )
        categories: dict[str, int] = defaultdict(int)
        for element in elements:
            categories[element.category] += 1

        return ExtractionResult(
            pages=pages,
            outputs={
                OutputFormat.JSON: elements_to_json(elements, indent=2),
                OutputFormat.TEXT: "\n\n".join(e.text for e in elements if e.text),
                OutputFormat.HTML: f"<!doctype html><html><body>\n{body}\n</body></html>",
                OutputFormat.MARKDOWN: "\n\n".join(p.text for p in pages),
            },
            warnings=warnings,
            metadata={"strategy": strategy, "elements": len(elements), "categories": json.loads(json.dumps(categories))},
        )
