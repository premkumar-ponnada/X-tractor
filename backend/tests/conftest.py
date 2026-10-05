"""Test setup: an isolated database and storage folder, and the synthetic fixture files."""

import os
import tempfile
from pathlib import Path

import pytest

# Must be set before any app module reads settings.
os.environ["XT_MONGODB_DATABASE"] = "xtractor_test"
os.environ["XT_STORAGE_DIR"] = tempfile.mkdtemp(prefix="xtractor-test-")
os.environ["XT_AUTH_EMAIL"] = "tester@xtractor.dev"
os.environ["XT_AUTH_PASSWORD"] = "test-password"

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session", autouse=True)
def fixture_files() -> Path:
    if not (FIXTURES / "anbud-paket.zip").exists():
        from tests.make_fixtures import main

        main()
    return FIXTURES


@pytest.fixture
def emit_log() -> list[tuple]:
    return []


@pytest.fixture
def emit(emit_log):
    return lambda stage, message, data=None: emit_log.append((stage, message, data))
