"""Name → adapter. Heavy SDKs are imported lazily inside their adapters."""

from extractors.base import Extractor, FileKind
from extractors.baseline_extractor import BaselineExtractor
from extractors.docling_extractor import DoclingExtractor
from extractors.markitdown_extractor import MarkItDownExtractor
from extractors.tika_extractor import TikaExtractor
from extractors.unstructured_extractor import UnstructuredExtractor

SDK_ORDER = ("docling", "unstructured", "tika", "markitdown", "baseline")
# Worker runs the quick SDKs first so the UI shows results within seconds.
EXECUTION_ORDER = ("baseline", "markitdown", "tika", "unstructured", "docling")


def build_registry(tika_url: str) -> dict[str, Extractor]:
    return {
        "docling": DoclingExtractor(),
        "unstructured": UnstructuredExtractor(),
        "tika": TikaExtractor(tika_url),
        "markitdown": MarkItDownExtractor(),
        "baseline": BaselineExtractor(),
    }


def supported_kinds(extractor: Extractor) -> list[str]:
    return [k.value for k in FileKind if k not in (FileKind.ZIP, FileKind.OTHER) and extractor.supports(k)]
