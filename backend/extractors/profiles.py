"""Static SDK profiles shown in the UI catalog.

Capability percentages are editorial ratings based on the SDKs' documentation and public
benchmarks (see `sources`); measured numbers from our own runs come from /api/stats/sdks.
"""

from typing import Any

CAPABILITY_LABELS = {
    "format_coverage": "Format coverage",
    "tables": "Table extraction",
    "ocr": "OCR / scanned pages",
    "layout": "Layout & reading order",
    "page_fidelity": "Page numbers kept",
    "speed": "Speed",
}

PROFILES: dict[str, dict[str, Any]] = {
    "docling": {
        "display_name": "Docling",
        "vendor": "IBM Research · LF AI & Data",
        "license": "MIT",
        "runtime": "Python (local AI models)",
        "homepage": "https://github.com/docling-project/docling",
        "color": "#2563eb",
        "tagline": "Layout-aware conversion with AI models for tables, reading order and OCR.",
        "description": (
            "Docling parses documents into a rich document model using layout and table-structure models. "
            "It keeps page provenance for every element, detects pictures and charts, and runs OCR only "
            "where pages have no text layer."
        ),
        "strengths": [
            "Best-in-class table structure (TableFormer model)",
            "Page number kept on every element",
            "Automatic OCR for scanned regions (Tesseract / EasyOCR / RapidOCR)",
            "Detects pictures and charts; optional local picture description",
            "Exports Markdown, lossless JSON, HTML, text and DocTags",
        ],
        "limitations": [
            "Slowest on CPU (~3 pages/s); GPU helps a lot",
            "Downloads AI models on first use (~1 GB)",
            "Legacy .doc/.xls/.ppt/.rtf need LibreOffice",
        ],
        "best_for": "Tender PDFs with tables, mixed layouts and scanned pages",
        "capabilities": {"format_coverage": 85, "tables": 95, "ocr": 85, "layout": 95, "page_fidelity": 95, "speed": 35},
        "requires": ["Python models", "Tesseract (OCR)", "LibreOffice (legacy formats)"],
        "sources": ["https://docling-project.github.io/docling/usage/supported_formats/"],
    },
    "unstructured": {
        "display_name": "Unstructured",
        "vendor": "Unstructured.io (open-source library)",
        "license": "Apache-2.0",
        "runtime": "Python (+ system tools)",
        "homepage": "https://github.com/Unstructured-IO/unstructured",
        "color": "#7c3aed",
        "tagline": "Partitions 60+ file types into typed elements with page metadata.",
        "description": (
            "Unstructured splits documents into elements (Title, NarrativeText, Table, ListItem…) with "
            "page_number metadata. Strategies range from fast text extraction to hi_res layout detection "
            "and OCR-only for scans."
        ),
        "strengths": [
            "Very wide format coverage incl. .msg, .eml, .rtf, .epub",
            "Typed elements with page numbers — great for chunking",
            "Tables as HTML (text_as_html)",
            "fast / hi_res / ocr_only strategies",
        ],
        "limitations": [
            "Heavy install (Tesseract, Poppler, LibreOffice, libmagic)",
            "hi_res mode is slow on CPU",
            "Some features only in the paid platform",
        ],
        "best_for": "Mixed packages with many file types, element-level chunking",
        "capabilities": {"format_coverage": 90, "tables": 80, "ocr": 80, "layout": 75, "page_fidelity": 90, "speed": 55},
        "requires": ["Tesseract (OCR)", "Poppler (PDF images)", "LibreOffice (legacy formats)"],
        "sources": ["https://docs.unstructured.io/open-source/introduction/supported-file-types"],
    },
    "tika": {
        "display_name": "Apache Tika",
        "vendor": "Apache Software Foundation",
        "license": "Apache-2.0",
        "runtime": "Java server (REST)",
        "homepage": "https://tika.apache.org/",
        "color": "#ea580c",
        "tagline": "Detects and extracts text and metadata from 1000+ file types.",
        "description": (
            "Tika is the long-standing standard for content detection and extraction, used by search "
            "engines. It runs as a REST server, handles legacy Office formats natively and returns XHTML "
            "with one block per PDF page."
        ),
        "strengths": [
            "Widest coverage: 1000+ formats incl. legacy Office natively",
            "Rich metadata (author, dates, page count, parsers used)",
            "Fast and battle-tested",
            "OCR via Tesseract",
        ],
        "limitations": [
            "Weak table structure (text only)",
            "No layout model — reading order can suffer in columns",
            "Needs a Java server",
        ],
        "best_for": "Unknown or legacy file types; fast first pass",
        "capabilities": {"format_coverage": 100, "tables": 45, "ocr": 70, "layout": 40, "page_fidelity": 80, "speed": 85},
        "requires": ["Java 11+", "Tika Server", "Tesseract (OCR)"],
        "sources": ["https://tika.apache.org/"],
    },
    "markitdown": {
        "display_name": "MarkItDown",
        "vendor": "Microsoft",
        "license": "MIT",
        "runtime": "Python",
        "homepage": "https://github.com/microsoft/markitdown",
        "color": "#0891b2",
        "tagline": "Fast conversion of common files into one Markdown string for LLMs.",
        "description": (
            "MarkItDown converts PDF, Office, HTML and more into Markdown that keeps headings, lists and "
            "tables. It is fast and lightweight, but returns one string without page boundaries and needs "
            "an LLM for images and OCR."
        ),
        "strengths": [
            "Very fast and lightweight",
            "Clean Markdown output",
            "Good for Office files and HTML",
        ],
        "limitations": [
            "No page numbers for PDF (breaks citations)",
            "No OCR without an LLM",
            "Multi-column PDFs can interleave",
        ],
        "best_for": "Quick Markdown from clean digital documents",
        "capabilities": {"format_coverage": 75, "tables": 60, "ocr": 10, "layout": 50, "page_fidelity": 15, "speed": 95},
        "requires": [],
        "sources": ["https://github.com/microsoft/markitdown"],
    },
    "baseline": {
        "display_name": "Baseline",
        "vendor": "pypdf · python-docx · openpyxl · xlrd",
        "license": "BSD / MIT",
        "runtime": "Python",
        "homepage": "https://github.com/py-pdf/pypdf",
        "color": "#64748b",
        "tagline": "Plain per-format readers — the reference every SDK should beat.",
        "description": (
            "A minimal pipeline like most hand-built systems use: pypdf for PDF text layers, python-docx "
            "for Word, openpyxl/xlrd for Excel and stdlib/extract-msg for mail. No OCR and no layout analysis."
        ),
        "strengths": [
            "Fast, tiny dependencies",
            "Exact PDF page numbers",
            "Easy to reason about",
        ],
        "limitations": [
            "No OCR — scanned pages are empty",
            "No table structure in PDFs",
            "No legacy .doc/.ppt/.rtf",
        ],
        "best_for": "Reference point and clean digital PDFs",
        "capabilities": {"format_coverage": 45, "tables": 30, "ocr": 0, "layout": 25, "page_fidelity": 85, "speed": 90},
        "requires": [],
        "sources": ["https://pypdf.readthedocs.io/"],
    },
}


def overall_score(capabilities: dict[str, int]) -> int:
    return round(sum(capabilities.values()) / len(capabilities))
