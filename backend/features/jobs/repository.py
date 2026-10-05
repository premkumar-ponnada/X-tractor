"""All MongoDB access for jobs, runs and events. Shared by the API and the worker."""

import re
from datetime import timedelta
from typing import Any

from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from core.db import Collections
from features.jobs.models import FINISHED_JOB, JobEvent, JobStatus, RunStatus, utcnow


class JobRepository:
    def __init__(self, db: AsyncDatabase) -> None:
        self.jobs = db[Collections.JOBS]
        self.runs = db[Collections.RUNS]
        self.events = db[Collections.EVENTS]
        self.workers = db[Collections.WORKERS]

    # ---- jobs -------------------------------------------------------------
    async def insert_job(self, doc: dict[str, Any]) -> None:
        await self.jobs.insert_one(doc)

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        return await self.jobs.find_one({"_id": job_id})

    async def list_jobs(self, *, skip: int, limit: int, status: str | None, search: str | None) -> tuple[list[dict], int]:
        query: dict[str, Any] = {}
        if status:
            query["status"] = status
        if search:
            query["name"] = {"$regex": _escape(search), "$options": "i"}
        total = await self.jobs.count_documents(query)
        cursor = self.jobs.find(query).sort("created_at", DESCENDING).skip(skip).limit(limit)
        return await cursor.to_list(length=limit), total

    async def update_job(self, job_id: str, fields: dict[str, Any]) -> None:
        await self.jobs.update_one({"_id": job_id}, {"$set": fields})

    async def set_files(self, job_id: str, files: list[dict[str, Any]]) -> None:
        await self.jobs.update_one({"_id": job_id}, {"$set": {"files": files}})

    async def delete_job(self, job_id: str) -> None:
        await self.runs.delete_many({"job_id": job_id})
        await self.events.delete_many({"job_id": job_id})
        await self.jobs.delete_one({"_id": job_id})

    async def claim_next_job(self, worker_id: str, max_attempts: int) -> dict[str, Any] | None:
        """Atomically move the oldest queued job to running for this worker."""
        now = utcnow()
        return await self.jobs.find_one_and_update(
            {"status": JobStatus.QUEUED, "attempts": {"$lt": max_attempts}},
            [
                {
                    "$set": {
                        "status": JobStatus.RUNNING.value,
                        "worker_id": worker_id,
                        "heartbeat_at": now,
                        "started_at": {"$ifNull": ["$started_at", now]},
                        "attempts": {"$add": [{"$ifNull": ["$attempts", 0]}, 1]},
                    }
                }
            ],
            sort=[("created_at", ASCENDING)],
            return_document=ReturnDocument.AFTER,
        )

    async def heartbeat(self, job_id: str, worker_id: str) -> bool:
        result = await self.jobs.update_one(
            {"_id": job_id, "worker_id": worker_id, "status": JobStatus.RUNNING}, {"$set": {"heartbeat_at": utcnow()}}
        )
        return result.modified_count == 1

    async def requeue_stale(self, stale_after: timedelta, max_attempts: int) -> list[str]:
        """Jobs whose worker stopped sending heartbeats: requeue them, or fail after max attempts."""
        cutoff = utcnow() - stale_after
        stale = await self.jobs.find({"status": JobStatus.RUNNING, "heartbeat_at": {"$lt": cutoff}}).to_list(None)
        ids = []
        for job in stale:
            exhausted = job.get("attempts", 0) >= max_attempts
            new_status = JobStatus.FAILED if exhausted else JobStatus.QUEUED
            updated = await self.jobs.update_one(
                {"_id": job["_id"], "status": JobStatus.RUNNING, "heartbeat_at": job["heartbeat_at"]},
                {
                    "$set": {
                        "status": new_status,
                        "worker_id": None,
                        **({"finished_at": utcnow(), "error": "Worker stopped too many times"} if exhausted else {}),
                    }
                },
            )
            if updated.modified_count:
                await self.runs.update_many(
                    {"job_id": job["_id"], "status": RunStatus.RUNNING},
                    {"$set": {"status": RunStatus.FAILED if exhausted else RunStatus.QUEUED}},
                )
                ids.append(job["_id"])
        return ids

    async def is_cancel_requested(self, job_id: str) -> bool:
        job = await self.jobs.find_one({"_id": job_id}, {"cancel_requested": 1})
        return bool(job and job.get("cancel_requested"))

    # ---- runs -------------------------------------------------------------
    async def insert_runs(self, docs: list[dict[str, Any]]) -> None:
        if docs:
            await self.runs.insert_many(docs)

    async def get_run(self, run_id: str) -> dict[str, Any] | None:
        return await self.runs.find_one({"_id": run_id})

    async def runs_for_job(self, job_id: str, file_id: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"job_id": job_id}
        if file_id:
            query["file_id"] = file_id
        return await self.runs.find(query).sort([("file_name", ASCENDING), ("sdk", ASCENDING)]).to_list(None)

    async def pending_runs(self, job_id: str) -> list[dict[str, Any]]:
        return await self.runs.find({"job_id": job_id, "status": RunStatus.QUEUED}).sort("order", ASCENDING).to_list(None)

    async def update_run(self, run_id: str, fields: dict[str, Any]) -> None:
        await self.runs.update_one({"_id": run_id}, {"$set": fields})

    async def reset_failed_runs(self, job_id: str) -> int:
        result = await self.runs.update_many(
            {"job_id": job_id, "status": {"$in": [RunStatus.FAILED, RunStatus.CANCELLED]}},
            {
                "$set": {
                    "status": RunStatus.QUEUED,
                    "error": None,
                    "metrics": {},
                    "warnings": [],
                    "started_at": None,
                    "finished_at": None,
                }
            },
        )
        return result.modified_count

    async def cancel_queued_runs(self, job_id: str) -> None:
        await self.runs.update_many({"job_id": job_id, "status": RunStatus.QUEUED}, {"$set": {"status": RunStatus.CANCELLED}})

    async def run_counts(self, job_id: str) -> dict[str, int]:
        rows = await self.runs.aggregate([{"$match": {"job_id": job_id}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}])
        return {row["_id"]: row["n"] async for row in rows}

    async def all_runs(self, query: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        projection = {"metrics": 1, "sdk": 1, "status": 1, "file_kind": 1, "job_id": 1}
        return await self.runs.find(query or {}, projection).to_list(None)

    # ---- events -----------------------------------------------------------
    async def add_event(self, job_id: str, **fields: Any) -> dict[str, Any]:
        job = await self.jobs.find_one_and_update(
            {"_id": job_id}, {"$inc": {"event_seq": 1}}, projection={"event_seq": 1}, return_document=ReturnDocument.AFTER
        )
        seq = job["event_seq"] if job else 0
        event = JobEvent(job_id=job_id, seq=seq, **fields).model_dump(mode="python")
        await self.events.insert_one(dict(event))
        return event

    async def events_after(self, job_id: str, seq: int, limit: int = 500) -> list[dict[str, Any]]:
        cursor = self.events.find({"job_id": job_id, "seq": {"$gt": seq}}).sort("seq", ASCENDING).limit(limit)
        return await cursor.to_list(length=limit)

    # ---- workers ----------------------------------------------------------
    async def worker_seen(self, worker_id: str, info: dict[str, Any]) -> None:
        await self.workers.update_one({"_id": worker_id}, {"$set": {**info, "seen_at": utcnow()}}, upsert=True)

    async def worker_gone(self, worker_id: str) -> None:
        await self.workers.delete_one({"_id": worker_id})

    async def live_workers(self, within: timedelta) -> list[dict[str, Any]]:
        return await self.workers.find({"seen_at": {"$gte": utcnow() - within}}).to_list(None)

    async def job_counts(self) -> dict[str, int]:
        rows = await self.jobs.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])
        return {row["_id"]: row["n"] async for row in rows}

    async def recent_jobs(self, limit: int) -> list[dict[str, Any]]:
        return await self.jobs.find().sort("created_at", DESCENDING).limit(limit).to_list(limit)


def _escape(text: str) -> str:
    return re.escape(text.strip()[:100])


def is_finished(status: str) -> bool:
    return status in FINISHED_JOB
