"""MongoDB connection (pymongo native async client) and collection names."""

import logging

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from config.settings import get_settings

log = logging.getLogger("db")


class Collections:
    JOBS = "jobs"
    RUNS = "runs"
    EVENTS = "job_events"
    WORKERS = "workers"


_client: AsyncMongoClient | None = None


async def connect_db() -> AsyncDatabase:
    global _client
    settings = get_settings()
    _client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000, tz_aware=True)
    await _client.admin.command("ping")
    db = _client[settings.mongodb_database]
    await _ensure_indexes(db)
    log.info("connected", extra={"database": settings.mongodb_database})
    return db


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def get_db() -> AsyncDatabase:
    if _client is None:
        raise RuntimeError("Database is not connected")
    return _client[get_settings().mongodb_database]


async def _ensure_indexes(db: AsyncDatabase) -> None:
    await db[Collections.JOBS].create_index([("status", ASCENDING), ("created_at", ASCENDING)])
    await db[Collections.JOBS].create_index([("created_at", DESCENDING)])
    await db[Collections.RUNS].create_index([("job_id", ASCENDING), ("file_id", ASCENDING), ("sdk", ASCENDING)])
    await db[Collections.RUNS].create_index([("sdk", ASCENDING), ("status", ASCENDING)])
    await db[Collections.EVENTS].create_index([("job_id", ASCENDING), ("seq", ASCENDING)], unique=True)
