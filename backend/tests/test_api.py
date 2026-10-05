"""API tests against a real (local) MongoDB, using an isolated test database."""

import pytest
from fastapi.testclient import TestClient

from tests.conftest import FIXTURES


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as test_client:
        yield test_client
        from core.db import get_db

        test_client.portal.call(get_db().client.drop_database, "xtractor_test")


@pytest.fixture(scope="module")
def signed_in(client):
    response = client.post("/api/auth/login", json={"email": "tester@xtractor.dev", "password": "test-password"})
    assert response.status_code == 200
    return client


def test_health_is_public(client):
    body = client.get("/api/health").json()
    assert body["checks"]["database"] is True


def test_protected_routes_need_a_session(client):
    fresh = TestClient(client.app)
    response = fresh.get("/api/jobs")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_wrong_password_is_rejected(client):
    response = client.post("/api/auth/login", json={"email": "tester@xtractor.dev", "password": "nope"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_login_sets_httponly_cookie(signed_in):
    assert signed_in.cookies.get("xt_session")
    assert signed_in.get("/api/auth/me").json()["user"]["email"] == "tester@xtractor.dev"


def test_sdk_catalog_lists_all_five(signed_in):
    body = signed_in.get("/api/sdks").json()
    names = [item["name"] for item in body["items"]]
    assert names == ["docling", "unstructured", "tika", "markitdown", "baseline"]
    docling = body["items"][0]
    assert {f["id"] for f in docling["output_formats"]} == {"markdown", "json", "html", "text", "doctags"}
    assert all(0 <= c["value"] <= 100 for c in docling["capabilities"])


def test_create_job_validates_sdks(signed_in):
    files = {"files": ("af-text.pdf", (FIXTURES / "af-text.pdf").read_bytes(), "application/pdf")}
    response = signed_in.post("/api/jobs", files=files, data={"sdks": "docling,not-an-sdk"})
    assert response.status_code == 400
    assert "Unknown SDK" in response.json()["error"]["message"]


def test_create_job_rejects_empty_file(signed_in):
    response = signed_in.post("/api/jobs", files={"files": ("empty.pdf", b"", "application/pdf")}, data={"sdks": "baseline"})
    assert response.status_code == 400


def test_create_list_and_delete_job(signed_in):
    files = [
        ("files", ("af-text.pdf", (FIXTURES / "af-text.pdf").read_bytes(), "application/pdf")),
        ("files", ("anbud-paket.zip", (FIXTURES / "anbud-paket.zip").read_bytes(), "application/zip")),
    ]
    created = signed_in.post("/api/jobs", files=files, data={"sdks": "baseline,markitdown", "name": "API test"})
    assert created.status_code == 202
    job = created.json()
    assert job["status"] == "queued" and job["name"] == "API test" and len(job["files"]) == 2

    events = signed_in.get(f"/api/jobs/{job['id']}/events/history").json()
    assert [e["type"] for e in events][:1] == ["job.created"]
    assert [e["seq"] for e in events] == sorted(e["seq"] for e in events)

    listed = signed_in.get("/api/jobs", params={"search": "API test"}).json()
    assert listed["total"] >= 1

    cancelled = signed_in.post(f"/api/jobs/{job['id']}/cancel").json()
    assert cancelled["status"] == "cancelled"
    assert signed_in.delete(f"/api/jobs/{job['id']}").status_code == 204
    assert signed_in.get(f"/api/jobs/{job['id']}").status_code == 404
