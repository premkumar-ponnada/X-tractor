"""Processes one claimed job: prepare files → create runs → execute each run → finish.

Every step writes a job event, which the UI shows as a live timeline.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

from config.settings import Settings
from core.storage import LocalStorage
from extractors.base import ExtractionResult, FileKind, Page
from extractors.containers import ZipLimitError, ZipLimits, iter_zip
from extractors.file_detect import detect_kind
from extractors.metrics import compute_metrics
from extractors.profiles import PROFILES
from extractors.registry import EXECUTION_ORDER, build_registry
from features.jobs.models import JobFile, JobStatus, Run, RunStatus, utcnow
from features.jobs.repository import JobRepository
from worker.pool import ExtractionPool

log = logging.getLogger("worker.runner")


class JobRunner:
    def __init__(
        self, repo: JobRepository, storage: LocalStorage, pool: ExtractionPool, settings: Settings, worker_id: str
    ) -> None:
        self.repo, self.storage, self.pool, self.settings, self.worker_id = repo, storage, pool, settings, worker_id
        self.registry = build_registry(settings.tika_url)
        self.zip_limits = ZipLimits(
            max_entries=settings.zip_max_entries,
            max_total_bytes=settings.zip_max_total_mb * 1024 * 1024,
            max_ratio=settings.zip_max_ratio,
        )

    async def event(self, job_id: str, type_: str, message: str, level: str = "info", **fields: Any) -> None:
        await self.repo.add_event(job_id, type=type_, message=message, level=level, **fields)

    # ---- entry point ------------------------------------------------------
    async def process(self, job: dict[str, Any]) -> None:
        job_id = job["_id"]
        heartbeat = asyncio.create_task(self._heartbeat(job_id))
        try:
            await self.event(
                job_id,
                "job.started",
                f"Worker picked up the job (attempt {job.get('attempts', 1)})",
                data={"worker": self.worker_id},
            )
            if not await self.repo.runs_for_job(job_id):
                await self._prepare(job)
            await self._execute(job_id)
            await self._finish(job_id)
        except Exception as exc:
            log.exception("job crashed", extra={"job_id": job_id})
            await self.repo.update_job(job_id, {"status": JobStatus.FAILED, "finished_at": utcnow(), "error": str(exc)[:500]})
            await self.event(job_id, "job.failed", f"Job failed: {exc}", "error")
        finally:
            heartbeat.cancel()

    async def _heartbeat(self, job_id: str) -> None:
        while True:
            await asyncio.sleep(self.settings.worker_heartbeat_seconds)
            await self.repo.heartbeat(job_id, self.worker_id)

    # ---- step 1: detect types, unpack zips, plan runs --------------------
    async def _prepare(self, job: dict[str, Any]) -> None:
        job_id = job["_id"]
        await self.event(job_id, "stage.prepare", "Detecting file types and unpacking archives")
        files = [JobFile(**f) for f in job["files"]]
        prepared: list[JobFile] = []
        queue = [(f, 0) for f in files]
        while queue:
            item, depth = queue.pop(0)
            path = self.storage.file_path(job_id, item.id, item.ext)
            kind, mime = await asyncio.to_thread(detect_kind, path, item.name)
            item.kind, item.mime = kind.value, mime
            await self.event(
                job_id,
                "file.detected",
                f"{item.name} detected as {kind.value.upper()}",
                file_id=item.id,
                file_name=item.name,
                data={"kind": kind.value, "mime": mime},
            )
            prepared.append(item)
            if kind == FileKind.ZIP:
                item.container = True
                children = await self._unpack(job_id, item, depth)
                queue.extend((child, depth + 1) for child in children)

        await self.repo.set_files(job_id, [f.model_dump() for f in prepared])
        runs: list[Run] = []
        for item in prepared:
            if item.container or item.error:
                continue
            for sdk in job["sdks"]:
                supported = self.registry[sdk].supports(FileKind(item.kind))
                runs.append(
                    Run(
                        job_id=job_id,
                        file_id=item.id,
                        file_name=item.name,
                        file_kind=item.kind,
                        sdk=sdk,
                        status=RunStatus.QUEUED if supported else RunStatus.UNSUPPORTED,
                        error=None if supported else f"{PROFILES[sdk]['display_name']} does not read {item.kind.upper()} files",
                    )
                )
        runs.sort(key=lambda r: (EXECUTION_ORDER.index(r.sdk), r.file_name.lower()))
        for order, run in enumerate(runs):
            run.order = order
        await self.repo.insert_runs([r.to_mongo() for r in runs])
        queued = sum(1 for r in runs if r.status == RunStatus.QUEUED)
        skipped = len(runs) - queued
        await self.event(
            job_id,
            "stage.planned",
            f"Planned {queued} run(s)" + (f", {skipped} unsupported" if skipped else ""),
            data={"queued": queued, "unsupported": skipped},
        )
        for run in runs:
            if run.status == RunStatus.UNSUPPORTED:
                await self.event(
                    job_id,
                    "run.unsupported",
                    run.error,
                    "warning",
                    sdk=run.sdk,
                    file_id=run.file_id,
                    file_name=run.file_name,
                    run_id=run.id,
                )

    async def _unpack(self, job_id: str, parent: JobFile, depth: int) -> list[JobFile]:
        if depth >= self.settings.zip_max_depth:
            parent.error = "Archive nested too deep"
            await self.event(
                job_id,
                "container.failed",
                f"{parent.name}: nested too deep — skipped",
                "warning",
                file_id=parent.id,
                file_name=parent.name,
            )
            return []
        path = self.storage.file_path(job_id, parent.id, parent.ext)
        try:
            entries = await asyncio.to_thread(lambda: list(iter_zip(path, self.zip_limits)))
        except (ZipLimitError, OSError, ValueError) as exc:
            parent.error = str(exc)
            await self.event(
                job_id, "container.failed", f"{parent.name}: {exc}", "error", file_id=parent.id, file_name=parent.name
            )
            return []
        except Exception as exc:  # BadZipFile and friends
            parent.error = f"Could not open archive: {exc}"
            await self.event(job_id, "container.failed", parent.error, "error", file_id=parent.id, file_name=parent.name)
            return []
        children = []
        for entry in entries:
            name = Path(entry.name).name
            child = JobFile(name=name, ext=Path(name).suffix.lower()[:12], size=len(entry.data), parent_id=parent.id)
            dest = self.storage.file_path(job_id, child.id, child.ext)
            dest.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(dest.write_bytes, entry.data)
            children.append(child)
        await self.event(
            job_id,
            "container.unpacked",
            f"Unpacked {len(children)} file(s) from {parent.name}",
            "success",
            file_id=parent.id,
            file_name=parent.name,
            data={"files": [c.name for c in children][:50]},
        )
        return children

    # ---- step 2: run every queued (file × SDK) ---------------------------
    async def _execute(self, job_id: str) -> None:
        job = await self.repo.get_job(job_id)
        files = {f["id"]: JobFile(**f) for f in job["files"]}
        options = {
            **{k: job["options"].get(k) for k in ("ocr", "ocr_languages", "tables")},
            "tika_url": self.settings.tika_url,
            "tesseract_cmd": self.settings.tesseract_cmd,
        }
        pending = await self.repo.pending_runs(job_id)
        for index, run in enumerate(pending, start=1):
            if await self.repo.is_cancel_requested(job_id):
                await self.repo.cancel_queued_runs(job_id)
                await self.event(job_id, "job.cancelled", "Stopped by user", "warning")
                return
            await self._execute_run(job_id, run, files[run["file_id"]], options, index, len(pending))

    async def _execute_run(self, job_id: str, run: dict, item: JobFile, options: dict, index: int, total: int) -> None:
        sdk, run_id = run["sdk"], run["_id"]
        name = PROFILES[sdk]["display_name"]
        ctx = {"sdk": sdk, "file_id": item.id, "file_name": item.name, "run_id": run_id}
        await self.repo.update_run(run_id, {"status": RunStatus.RUNNING, "started_at": utcnow()})
        await self.event(job_id, "run.started", f"{name} started on {item.name}", data={"index": index, "total": total}, **ctx)

        async def on_progress(progress: dict) -> None:
            await self.event(
                job_id, f"run.{progress['stage']}", f"{name}: {progress['message']}", data=progress.get("data"), **ctx
            )

        outcome = await self.pool.run(
            sdk=sdk,
            path=str(self.storage.file_path(job_id, item.id, item.ext)),
            kind=item.kind,
            options=options,
            timeout=self.settings.run_timeout_seconds,
            on_progress=on_progress,
        )
        if not outcome.get("ok"):
            if outcome.get("trace"):
                log.error("run failed", extra={"run_id": run_id, "sdk": sdk, "trace": outcome["trace"]})
            await self.repo.update_run(
                run_id,
                {
                    "status": RunStatus.FAILED,
                    "finished_at": utcnow(),
                    "error": outcome.get("error"),
                    "metrics": {"duration_ms": outcome.get("duration_ms", 0)},
                },
            )
            await self.event(job_id, "run.failed", f"{name} failed on {item.name}: {outcome.get('error')}", "error", **ctx)
            return

        result = ExtractionResult.model_validate(outcome["result"])
        await asyncio.to_thread(self._store_outputs, job_id, run_id, result)
        metrics = compute_metrics(result.pages, outcome["duration_ms"], result.page_fidelity)
        await self.repo.update_run(
            run_id,
            {
                "status": RunStatus.COMPLETED,
                "finished_at": utcnow(),
                "sdk_version": outcome.get("version"),
                "metrics": metrics,
                "output_formats": [f.value for f in result.outputs],
                "warnings": result.warnings[:50],
                "metadata": result.metadata,
            },
        )
        for warning in result.warnings[:5]:
            await self.event(job_id, "run.warning", f"{name}: {warning}", "warning", **ctx)
        summary = (
            f"{metrics['pages']} page(s), {metrics['text_coverage_pct']}% with text in {metrics['duration_ms'] / 1000:.1f} s"
        )
        await self.event(
            job_id,
            "run.completed",
            f"{name} finished {item.name}: {summary}",
            "success",
            data={k: metrics[k] for k in ("pages", "text_coverage_pct", "duration_ms", "tables", "chars")},
            **ctx,
        )

    def _store_outputs(self, job_id: str, run_id: str, result: ExtractionResult) -> None:
        self.storage.write_pages(job_id, run_id, [Page.model_validate(p).model_dump() for p in result.pages])
        for fmt, content in result.outputs.items():
            self.storage.write_run_output(job_id, run_id, fmt.value, content)

    # ---- step 3: final status ---------------------------------------------
    async def _finish(self, job_id: str) -> None:
        counts = await self.repo.run_counts(job_id)
        completed, failed = counts.get(RunStatus.COMPLETED, 0), counts.get(RunStatus.FAILED, 0)
        if counts.get(RunStatus.CANCELLED):
            status = JobStatus.CANCELLED
        elif failed and not completed:
            status = JobStatus.FAILED
        elif failed:
            status = JobStatus.PARTIAL
        else:
            status = JobStatus.COMPLETED
        await self.repo.update_job(job_id, {"status": status, "finished_at": utcnow(), "worker_id": None})
        level = {"completed": "success", "partial": "warning"}.get(status, "error" if status == JobStatus.FAILED else "warning")
        await self.event(
            job_id, "job.completed", f"Job {status.value}: {completed} run(s) succeeded, {failed} failed", level, data=counts
        )
