"""Apache Tika via its REST server (Java). Widest format coverage; OCR through Tesseract.

Tika's XHTML marks PDF pages with <div class="page">, which gives us page boundaries.
"""

import json
import re
from html import unescape
from pathlib import Path

import httpx

from extractors.base import EmitFn, ExtractionError, ExtractionResult, ExtractOptions, FileKind, OutputFormat, Page

PAGE_DIV = re.compile(r'<div class="page">(.*?)</div>\s*(?=<div class="page">|</body>)', re.DOTALL)
BODY = re.compile(r"<body[^>]*>(.*)</body>", re.DOTALL)
TABLE = re.compile(r"<table\b", re.IGNORECASE)
IMAGE = re.compile(r'<img\b|class="embedded"', re.IGNORECASE)
TAG = re.compile(r"<[^>]+>")
BLOCK_END = re.compile(r"(?i)</p>|<br\s*/?>|</h\d>|</tr>|</li>|</div>")
TIMEOUT = httpx.Timeout(connect=5, read=600, write=120, pool=5)


def _xhtml_to_text(fragment: str) -> str:
    text = BLOCK_END.sub("\n", fragment)
    text = re.sub(r"(?i)</t[dh]>", "\t", text)
    text = unescape(TAG.sub("", text))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


class TikaExtractor:
    name = "tika"

    def __init__(self, base_url: str = "http://localhost:9998") -> None:
        self.base_url = base_url.rstrip("/")

    def version(self) -> str | None:
        try:
            response = httpx.get(f"{self.base_url}/version", timeout=3)
            return response.text.strip() if response.is_success else None
        except httpx.HTTPError:
            return None

    def supports(self, kind: FileKind) -> bool:
        return kind != FileKind.ZIP  # zips are unpacked by X-tractor first

    def output_formats(self) -> list[OutputFormat]:
        return [OutputFormat.TEXT, OutputFormat.XHTML, OutputFormat.METADATA]

    def availability(self) -> tuple[bool, str]:
        version = self.version()
        if version is None:
            return False, f"Tika server not reachable at {self.base_url}"
        return True, version

    def extract(self, path: Path, kind: FileKind, opts: ExtractOptions, emit: EmitFn) -> ExtractionResult:
        self.base_url = opts.tika_url.rstrip("/")
        headers = {
            "X-Tika-PDFOcrStrategy": "auto" if opts.ocr else "no_ocr",
            "X-Tika-OCRLanguage": opts.ocr_languages,
            "X-Tika-PDFextractInlineImages": "false",
        }
        if not opts.ocr:
            headers["X-Tika-OCRskipOcr"] = "true"
        data = path.read_bytes()
        try:
            with httpx.Client(base_url=self.base_url, timeout=TIMEOUT) as client:
                emit("upload", "Sending file to Tika server", {"bytes": len(data)})
                xhtml = self._put(client, "/tika", data, {**headers, "Accept": "text/html"})
                emit("parse", "Parsed by Tika — reading metadata", None)
                metadata = json.loads(self._put(client, "/meta", data, {"Accept": "application/json"}))
        except httpx.ConnectError as exc:
            raise ExtractionError(f"Tika server not reachable at {self.base_url} — is it running?") from exc
        except httpx.TimeoutException as exc:
            raise ExtractionError("Tika server timed out") from exc

        pages = self._pages(xhtml)
        text = "\n\n".join(f"--- Page {p.n} ---\n{p.text}" for p in pages)
        warnings = []
        if kind == FileKind.PDF and len(pages) == 1 and int(metadata.get("xmpTPg:NPages", 1) or 1) > 1:
            warnings.append("Tika returned no page markers for a multi-page PDF")
        return ExtractionResult(
            pages=pages,
            outputs={
                OutputFormat.TEXT: text,
                OutputFormat.XHTML: xhtml,
                OutputFormat.METADATA: json.dumps(metadata, ensure_ascii=False, indent=2),
            },
            warnings=warnings,
            metadata={"content_type": metadata.get("Content-Type"), "parsers": metadata.get("X-TIKA:Parsed-By")},
        )

    @staticmethod
    def _put(client: httpx.Client, url: str, data: bytes, headers: dict[str, str]) -> str:
        response = client.put(url, content=data, headers=headers)
        if response.status_code == 422:
            raise ExtractionError("Tika could not parse this file (unsupported or corrupt)")
        if not response.is_success:
            raise ExtractionError(f"Tika server error {response.status_code}")
        response.encoding = "utf-8"
        return response.text

    @staticmethod
    def _pages(xhtml: str) -> list[Page]:
        fragments = PAGE_DIV.findall(xhtml)
        if not fragments:
            body = BODY.search(xhtml)
            fragments = [body.group(1) if body else xhtml]
        return [
            Page(n=i, text=_xhtml_to_text(f), tables=len(TABLE.findall(f)), images=len(IMAGE.findall(f)))
            for i, f in enumerate(fragments, start=1)
        ]
