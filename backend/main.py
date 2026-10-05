"""X-tractor API. Run: uvicorn main:app --port 8000 (and python run_worker.py in a second terminal)."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from core.db import close_db, connect_db
from core.errors import register_error_handlers
from core.logging import setup_logging
from features.auth.routes import router as auth_router
from features.jobs.routes import router as jobs_router
from features.results.routes import router as results_router
from features.sdks.routes import router as sdks_router
from features.stats.routes import router as stats_router
from features.system_routes import router as system_router

log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    setup_logging(settings.log_level)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    await connect_db()
    log.info("api started", extra={"env": settings.app_env})
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="X-tractor API",
        version="1.0.0",
        description="Run and compare document extraction SDKs on the same files.",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )
    register_error_handlers(app)

    @app.middleware("http")
    async def security_and_logging(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if request.url.path.startswith("/api") and not request.url.path.endswith("/events"):
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "ms": round((time.perf_counter() - started) * 1000),
                },
            )
        return response

    # Added last so it wraps everything, including error responses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "Last-Event-ID"],
    )

    api = APIRouter(prefix="/api")
    for router in (system_router, auth_router, sdks_router, jobs_router, results_router, stats_router):
        api.include_router(router)
    app.include_router(api)
    return app


app = create_app()
