"""Job, file, run and event documents (MongoDB) and their API shapes."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from extractors.base import ExtractOptions


def new_id() -> str:
    return uuid4().hex


def utcnow() -> datetime:
    return datetime.now(UTC)


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"  # finished, but some runs failed
    FAILED = "failed"
    CANCELLED = "cancelled"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    UNSUPPORTED = "unsupported"
    CANCELLED = "cancelled"


FINISHED_JOB = {JobStatus.COMPLETED, JobStatus.PARTIAL, JobStatus.FAILED, JobStatus.CANCELLED}


class JobFile(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    ext: str
    size: int
    kind: str | None = None
    mime: str | None = None
    parent_id: str | None = None  # set for files unpacked from a zip
    container: bool = False
    error: str | None = None


class JobOptions(ExtractOptions):
    """User-chosen options; service URLs are filled in by the worker, never by the client."""


class Job(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    name: str
    status: JobStatus = JobStatus.QUEUED
    sdks: list[str]
    options: JobOptions
    files: list[JobFile]
    owner: str
    created_at: datetime = Field(default_factory=utcnow)
    started_at: datetime | None = None
    finished_at: datetime | None = None
    worker_id: str | None = None
    heartbeat_at: datetime | None = None
    attempts: int = 0
    cancel_requested: bool = False
    event_seq: int = 0
    error: str | None = None

    model_config = {"populate_by_name": True}

    def to_mongo(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True, mode="python")


class Run(BaseModel):
    id: str = Field(default_factory=new_id, alias="_id")
    job_id: str
    file_id: str
    file_name: str
    file_kind: str | None
    sdk: str
    order: int = 0  # execution order: fast SDKs first so results appear early
    status: RunStatus = RunStatus.QUEUED
    sdk_version: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    output_formats: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None

    model_config = {"populate_by_name": True}

    def to_mongo(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True, mode="python")


class JobEvent(BaseModel):
    job_id: str
    seq: int
    ts: datetime = Field(default_factory=utcnow)
    type: str
    level: str = "info"  # info | success | warning | error
    message: str
    sdk: str | None = None
    file_id: str | None = None
    file_name: str | None = None
    run_id: str | None = None
    data: dict[str, Any] | None = None


def public_job(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    for key in ("worker_id", "event_seq", "attempts", "heartbeat_at", "cancel_requested"):
        doc.pop(key, None)
    return doc


def public_run(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    return doc


def public_event(doc: dict[str, Any]) -> dict[str, Any]:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc
