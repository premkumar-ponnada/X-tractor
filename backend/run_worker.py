"""X-tractor extraction worker. Run: python run_worker.py

Claims queued jobs from MongoDB, runs the SDKs in child processes and writes results + events.
Start several workers (or containers) to scale; claiming is atomic.
"""

import asyncio
import logging
import os
import signal
import socket
from datetime import timedelta
from uuid import uuid4

from config.settings import get_settings
from core.db import close_db, connect_db
from core.logging import setup_logging
from core.storage import get_storage
from features.jobs.repository import JobRepository
from worker.pool import ExtractionPool
from worker.runner import JobRunner

log = logging.getLogger("worker")


async def _maintenance(repo: JobRepository, worker_id: str, stop: asyncio.Event) -> None:
    settings = get_settings()
    while not stop.is_set():
        await repo.worker_seen(worker_id, {"host": socket.gethostname(), "pid": os.getpid()})
        requeued = await repo.requeue_stale(timedelta(seconds=settings.worker_stale_seconds), settings.job_max_attempts)
        for job_id in requeued:
            await repo.add_event(job_id, type="job.requeued", level="warning", message="Worker stopped responding — job requeued")
            log.warning("requeued stale job", extra={"job_id": job_id})
        try:
            await asyncio.wait_for(stop.wait(), timeout=settings.worker_heartbeat_seconds)
        except TimeoutError:
            pass


async def main() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    db = await connect_db()
    repo = JobRepository(db)
    worker_id = f"{socket.gethostname()}-{os.getpid()}-{uuid4().hex[:6]}"
    pool = ExtractionPool(settings.worker_processes)
    runner = JobRunner(repo, get_storage(), pool, settings, worker_id)

    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows: rely on KeyboardInterrupt
            pass

    maintenance = asyncio.create_task(_maintenance(repo, worker_id, stop))
    log.info("worker started", extra={"worker_id": worker_id, "processes": settings.worker_processes})
    try:
        while not stop.is_set():
            job = await repo.claim_next_job(worker_id, settings.job_max_attempts)
            if job is None:
                try:
                    await asyncio.wait_for(stop.wait(), timeout=settings.worker_poll_seconds)
                except TimeoutError:
                    pass
                continue
            log.info("job claimed", extra={"job_id": job["_id"]})
            await runner.process(job)
    finally:
        stop.set()
        maintenance.cancel()
        await repo.worker_gone(worker_id)
        pool.close()
        await close_db()
        log.info("worker stopped", extra={"worker_id": worker_id})


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
