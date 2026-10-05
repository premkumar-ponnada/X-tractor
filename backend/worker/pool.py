"""Process pool for extraction with per-run timeout and crash recovery.

A stuck or crashed SDK only costs that one run: the pool is torn down and rebuilt.
"""

import asyncio
import logging
import multiprocessing
import queue
from collections.abc import Awaitable, Callable
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from typing import Any

from worker.child import execute_run

log = logging.getLogger("worker.pool")
DRAIN_INTERVAL = 0.3


class ExtractionPool:
    def __init__(self, processes: int) -> None:
        self.processes = processes
        self._context = multiprocessing.get_context("spawn")
        self._manager = self._context.Manager()
        self._executor = self._new_executor()

    def _new_executor(self) -> ProcessPoolExecutor:
        return ProcessPoolExecutor(max_workers=self.processes, mp_context=self._context)

    def _reset(self) -> None:
        """Kill all child processes (a timed-out task cannot be cancelled any other way)."""
        processes = list(getattr(self._executor, "_processes", {}).values())
        self._executor.shutdown(wait=False, cancel_futures=True)
        for process in processes:
            if process.is_alive():
                process.kill()
        self._executor = self._new_executor()

    async def run(
        self,
        *,
        sdk: str,
        path: str,
        kind: str,
        options: dict[str, Any],
        timeout: float,
        on_progress: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> dict[str, Any]:
        events = self._manager.Queue()
        loop = asyncio.get_running_loop()
        future = loop.run_in_executor(self._executor, execute_run, sdk, path, kind, options, events)
        drain = asyncio.create_task(self._drain(events, on_progress))
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except TimeoutError:
            log.warning("run timed out; restarting pool", extra={"sdk": sdk, "timeout": timeout})
            self._reset()
            return {"ok": False, "error": f"Timed out after {int(timeout)} s", "duration_ms": int(timeout * 1000)}
        except BrokenProcessPool:
            log.error("extraction process crashed; restarting pool", extra={"sdk": sdk})
            self._reset()
            return {"ok": False, "error": "The extraction process crashed (out of memory or a native library error)"}
        finally:
            drain.cancel()
            await self._flush(events, on_progress)

    async def _drain(self, events, on_progress) -> None:
        while True:
            await self._flush(events, on_progress)
            await asyncio.sleep(DRAIN_INTERVAL)

    @staticmethod
    async def _flush(events, on_progress) -> None:
        while True:
            try:
                item = events.get_nowait()
            except (queue.Empty, EOFError, OSError, BrokenPipeError):
                return
            await on_progress(item)

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
        self._manager.shutdown()
