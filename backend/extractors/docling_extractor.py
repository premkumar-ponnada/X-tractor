"""IBM Docling: layout + table-structure models, OCR only where pages lack text."""

import json
import tempfile
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
from extractors.libreoffice import convert_to_modern, libreoffice_available
from extractors.ocr import usable_languages

LEGACY_KINDS = {FileKind.DOC, FileKind.XLS, FileKind.PPT, FileKind.RTF}
OCR_KINDS = {FileKind.PDF, FileKind.IMAGE}
KINDS = {
    FileKind.PDF,
    FileKind.DOCX,
    FileKind.XLSX,
    FileKind.PPTX,
    FileKind.HTML,
    FileKind.MD,
    FileKind.CSV,
    FileKind.IMAGE,
    FileKind.EML,
    FileKind.MSG,
    FileKind.ODT,
    FileKind.ODS,
    FileKind.ODP,
    FileKind.EPUB,
} | LEGACY_KINDS

_converters: dict[tuple, object] = {}


def _converter(ocr: bool, languages: tuple[str, ...], tesseract_cmd: str):
    key = (ocr, languages, tesseract_cmd)
    if key not in _converters:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
        from docling.document_converter import DocumentConverter, ImageFormatOption, PdfFormatOption

        options = PdfPipelineOptions(
            do_ocr=ocr,
            do_table_structure=True,
            do_picture_classification=True,
            ocr_options=TesseractCliOcrOptions(lang=list(languages) or ["eng"], tesseract_cmd=tesseract_cmd),
        )
        _converters[key] = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=options),
                InputFormat.IMAGE: ImageFormatOption(pipeline_options=options),
            }
        )
    return _converters[key]


def _page_of(item) -> int:
    prov = getattr(item, "prov", None) or []
    return prov[0].page_no if prov else 1


class DoclingExtractor:
    name = "docling"

    def version(self) -> str | None:
        return package_version("docling")

    def supports(self, kind: FileKind) -> bool:
        return kind in KINDS

    def output_formats(self) -> list[OutputFormat]:
        return [OutputFormat.MARKDOWN, OutputFormat.JSON, OutputFormat.HTML, OutputFormat.TEXT, OutputFormat.DOCTAGS]

    def availability(self) -> tuple[bool, str]:
        if package_version("docling") is None:
            return False, "docling is not installed"
        note = "Ready" if libreoffice_available() else "Ready (install LibreOffice for .doc/.xls/.ppt/.rtf)"
        return True, note

    def extract(self, path: Path, kind: FileKind, opts: ExtractOptions, emit: EmitFn) -> ExtractionResult:
        from docling.datamodel.base_models import ConversionStatus

        warnings: list[str] = []
        if kind in LEGACY_KINDS and not libreoffice_available():
            raise ExtractionError("Legacy Office format needs LibreOffice, which is not installed")
        languages: tuple[str, ...] = ()
        if opts.ocr and kind in OCR_KINDS:
            available, missing = usable_languages(opts.ocr_languages, opts.tesseract_cmd)
            languages = tuple(available)
            if missing:
                warnings.append(
                    f"Tesseract language data missing: {', '.join(missing)} — OCR used {'+'.join(available) or 'none'}"
                )

        emit("models", "Loading layout and table models", None)
        converter = _converter(opts.ocr, languages, opts.tesseract_cmd)
        with tempfile.TemporaryDirectory(prefix="xt-docling-") as scratch:
            source = path
            if kind in LEGACY_KINDS:
                # Docling's own legacy conversion fails on some inputs (e.g. RTF); convert first.
                emit("convert", f"Converting {path.suffix} to a modern format with LibreOffice", None)
                try:
                    source = convert_to_modern(path, Path(scratch))
                except (RuntimeError, OSError) as exc:
                    raise ExtractionError(str(exc)) from exc
                warnings.append(f"Converted {path.suffix} to {source.suffix} with LibreOffice before extraction")
            emit("parse", "Analysing layout, tables and reading order" + (" with OCR" if opts.ocr else ""), None)
            try:
                result = converter.convert(source, raises_on_error=False)
            except Exception as exc:
                raise ExtractionError(f"Docling could not convert the file: {exc}") from exc
        if result.status == ConversionStatus.FAILURE:
            reasons = "; ".join(str(e.error_message) for e in (result.errors or [])) or "unknown error"
            raise ExtractionError(f"Docling failed: {reasons}")
        if result.status == ConversionStatus.PARTIAL_SUCCESS:
            warnings.append("Docling converted the document only partially")
        for error in result.errors or []:
            warnings.append(str(error.error_message))

        document = result.document
        emit("export", "Exporting pages and output formats", None)
        page_numbers = sorted(document.pages) or [1]
        tables_per_page: dict[int, int] = {}
        for table in document.tables:
            tables_per_page[_page_of(table)] = tables_per_page.get(_page_of(table), 0) + 1
        images_per_page: dict[int, int] = {}
        for picture in document.pictures:
            images_per_page[_page_of(picture)] = images_per_page.get(_page_of(picture), 0) + 1

        if document.pages:
            pages = [
                Page(
                    n=n,
                    text=document.export_to_markdown(page_no=n),
                    tables=tables_per_page.get(n, 0),
                    images=images_per_page.get(n, 0),
                )
                for n in page_numbers
            ]
        else:  # Office/HTML inputs have no physical pages
            pages = [Page(n=1, text=document.export_to_markdown(), tables=len(document.tables), images=len(document.pictures))]

        return ExtractionResult(
            pages=pages,
            outputs={
                OutputFormat.MARKDOWN: document.export_to_markdown(),
                OutputFormat.JSON: json.dumps(document.export_to_dict(), ensure_ascii=False),
                OutputFormat.HTML: document.export_to_html(),
                OutputFormat.TEXT: document.export_to_text(),
                OutputFormat.DOCTAGS: document.export_to_doctags(),
            },
            warnings=warnings,
            metadata={"status": result.status.value, "tables": len(document.tables), "pictures": len(document.pictures)},
        )
