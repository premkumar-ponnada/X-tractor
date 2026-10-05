"""File detection, zip safety, metrics, scoring and the two fast extractors."""

import zipfile
from pathlib import Path

import pytest

from extractors.base import ExtractOptions, FileKind, Page
from extractors.baseline_extractor import BaselineExtractor
from extractors.containers import ZipLimitError, ZipLimits, iter_zip
from extractors.file_detect import detect_kind
from extractors.markitdown_extractor import MarkItDownExtractor
from extractors.metrics import compute_metrics
from features.results.scoring import score_file_runs
from tests.conftest import FIXTURES

LIMITS = ZipLimits(max_entries=100, max_total_bytes=50 * 1024 * 1024, max_ratio=200)


@pytest.mark.parametrize(
    ("name", "kind"),
    [
        ("af-text.pdf", FileKind.PDF),
        ("miljo-scanned.pdf", FileKind.PDF),
        ("teknisk-beskrivning.docx", FileKind.DOCX),
        ("mangder.xlsx", FileKind.XLSX),
        ("anbud-paket.zip", FileKind.ZIP),
        ("forfragan.eml", FileKind.EML),
        ("poster.csv", FileKind.CSV),
    ],
)
def test_detects_kind_from_content(name, kind):
    assert detect_kind(FIXTURES / name, name)[0] == kind


def test_content_beats_wrong_extension(tmp_path):
    disguised = tmp_path / "report.txt"
    disguised.write_bytes((FIXTURES / "af-text.pdf").read_bytes())
    assert detect_kind(disguised, "report.txt")[0] == FileKind.PDF


def test_docx_is_not_treated_as_zip():
    assert detect_kind(FIXTURES / "teknisk-beskrivning.docx", "renamed.zip")[0] == FileKind.DOCX


def test_zip_skips_junk_and_keeps_names():
    names = [entry.name for entry in iter_zip(FIXTURES / "anbud-paket.zip", LIMITS)]
    assert names == ["underlag/af-text.pdf", "underlag/teknisk-beskrivning.docx", "underlag/mangder.xlsx"]


def test_zip_bomb_ratio_is_rejected(tmp_path):
    bomb = tmp_path / "bomb.zip"
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("zeros.txt", b"\0" * 5_000_000)
    with pytest.raises(ZipLimitError, match="compression ratio"):
        list(iter_zip(bomb, LIMITS))


def test_zip_entry_limit(tmp_path):
    many = tmp_path / "many.zip"
    with zipfile.ZipFile(many, "w") as archive:
        for i in range(5):
            archive.writestr(f"f{i}.txt", b"x")
    with pytest.raises(ZipLimitError, match="files"):
        list(iter_zip(many, ZipLimits(max_entries=3, max_total_bytes=10**6, max_ratio=200)))


def test_metrics_counts_empty_pages_and_swedish():
    pages = [Page(n=1, text="Färdigställd senast 2026-12-18, Ödla 4 åtgärdas."), Page(n=2, text="  ")]
    metrics = compute_metrics(pages, duration_ms=500, page_fidelity=True)
    assert metrics["pages"] == 2
    assert metrics["empty_pages"] == [2]
    assert metrics["text_coverage_pct"] == 50.0
    assert metrics["swedish_chars"] == 5  # ä, ä, Ö, å, ä
    assert metrics["encoding_errors"] == 0
    assert metrics["pages_per_second"] == 4.0


def test_metrics_flags_mojibake():
    metrics = compute_metrics([Page(n=1, text="FÃ¤rdigstÃ¤lld enligt AMA, � okänt")], 10, True)
    assert metrics["encoding_errors"] == 3


def test_scoring_is_relative_per_file():
    def run(run_id, chars, ms, fidelity=True):
        metrics = {"text_coverage_pct": 100, "chars": chars, "tables": 0, "duration_ms": ms, "page_fidelity": fidelity}
        return {"_id": run_id, "status": "completed", "metrics": metrics}

    scores = score_file_runs([run("full", 1000, 100), run("half", 500, 100), run("flat", 1000, 100, fidelity=False)])
    assert scores["full"]["score"] == 100.0
    assert scores["half"]["score"] < scores["full"]["score"]
    assert scores["flat"]["parts"]["pages"] == 0.0


def test_baseline_pdf_keeps_pages_and_swedish(emit):
    result = BaselineExtractor().extract(FIXTURES / "af-text.pdf", FileKind.PDF, ExtractOptions(), emit)
    assert [p.n for p in result.pages] == [1, 2]
    assert "färdigställd" in result.pages[0].text.lower()
    assert "Mängdförteckning" in result.pages[1].text
    assert set(result.outputs) == {"text", "json"}


def test_baseline_docx_reads_header_footer_and_table(emit):
    result = BaselineExtractor().extract(FIXTURES / "teknisk-beskrivning.docx", FileKind.DOCX, ExtractOptions(), emit)
    text = result.pages[0].text
    assert "Förfrågningsunderlag" in text  # header
    assert "Konfidentiellt" in text  # footer
    assert "120 m²" in text  # table cell
    assert result.pages[0].tables == 1


def test_baseline_scanned_pdf_has_no_text(emit):
    result = BaselineExtractor().extract(FIXTURES / "miljo-scanned.pdf", FileKind.PDF, ExtractOptions(), emit)
    assert compute_metrics(result.pages, 1, True)["text_coverage_pct"] == 0.0


def test_markitdown_flags_lost_page_boundaries(emit):
    result = MarkItDownExtractor().extract(FIXTURES / "af-text.pdf", FileKind.PDF, ExtractOptions(), emit)
    assert len(result.pages) == 1
    assert result.page_fidelity is False
    assert any("page boundaries" in w for w in result.warnings)


def test_every_adapter_declares_formats_and_kinds():
    from extractors.registry import build_registry

    for name, extractor in build_registry("http://localhost:1").items():
        assert extractor.output_formats(), name
        assert extractor.supports(FileKind.PDF), name
        assert not extractor.supports(FileKind.ZIP), name


def test_fixture_folder_exists():
    assert Path(FIXTURES).is_dir()
