"""Local development launcher: API + worker + Tika server in one terminal.

    .\\venv\\Scripts\\python.exe run_backend.py            # all three
    .\\venv\\Scripts\\python.exe run_backend.py --no-tika  # skip Tika (e.g. already running)

Logs are prefixed per service; Ctrl+C stops everything. If one service exits on its own,
the others are stopped too, so a broken setup is never half-running.
Production keeps these as separate processes/containers (see docker-compose.yml).
"""

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
TIKA_DIR = BACKEND.parent / "tools" / "tika"
IS_WINDOWS = os.name == "nt"
COLORS = {"api": "\033[36m", "worker": "\033[35m", "tika": "\033[33m", "launcher": "\033[32m"}
RESET = "\033[0m"
print_lock = threading.Lock()


def say(service: str, line: str) -> None:
    with print_lock:
        print(f"{COLORS.get(service, '')}{service:>8} │{RESET} {line}", flush=True)


def port_open(port: int) -> bool:
    with socket.socket() as sock:
        sock.settimeout(0.3)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def find_tika_jar() -> Path | None:
    jars = sorted(TIKA_DIR.glob("tika-server-standard-*.jar"))
    return jars[-1] if jars else None


class Service:
    def __init__(self, name: str, command: list[str], cwd: Path) -> None:
        self.name, self.command, self.cwd = name, command, cwd
        self.process: subprocess.Popen | None = None

    def start(self) -> None:
        env = {**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"}
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if IS_WINDOWS else 0
        self.process = subprocess.Popen(
            self.command,
            cwd=self.cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            creationflags=flags,
            start_new_session=not IS_WINDOWS,
        )
        threading.Thread(target=self._pipe, daemon=True).start()
        say("launcher", f"started {self.name} (pid {self.process.pid})")

    def _pipe(self) -> None:
        assert self.process and self.process.stdout
        for line in self.process.stdout:
            say(self.name, line.rstrip())

    def running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def stop(self) -> None:
        """Stop the whole process tree (uvicorn's reloader and the worker's pool have children)."""
        if not self.running():
            return
        pid = self.process.pid
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
        else:
            try:
                os.killpg(pid, signal.SIGTERM)
                self.process.wait(timeout=10)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                os.killpg(pid, signal.SIGKILL)
        say("launcher", f"stopped {self.name}")


def build_services(args: argparse.Namespace) -> list[Service]:
    python = sys.executable
    services: list[Service] = []

    if not args.no_tika:
        if port_open(9998):
            say("launcher", "Tika already running on :9998 — using it")
        elif not shutil.which("java"):
            say("launcher", "Java not found — Tika skipped (Apache Tika runs will fail)")
        elif (jar := find_tika_jar()) is None:
            say("launcher", f"No Tika jar in {TIKA_DIR} — Tika skipped (see README)")
        else:
            services.append(Service("tika", ["java", "-jar", jar.name, "--host", "localhost", "--port", "9998"], TIKA_DIR))

    api = [python, "-m", "uvicorn", "main:app", "--port", str(args.port)]
    if not args.no_reload:
        api += [
            "--reload",
            "--reload-dir",
            str(BACKEND / "features"),
            "--reload-dir",
            str(BACKEND / "core"),
            "--reload-dir",
            str(BACKEND / "config"),
            "--reload-dir",
            str(BACKEND / "extractors"),
        ]
    services.append(Service("api", api, BACKEND))
    services.append(Service("worker", [python, "run_worker.py"], BACKEND))
    return services


def wait_until_ready(port: int, timeout: float = 60) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}/api/health", timeout=2) as response:
                if response.status == 200:
                    return True
        except OSError:
            time.sleep(1)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the X-tractor backend (API + worker + Tika) for local development.")
    parser.add_argument("--port", type=int, default=8000, help="API port (default 8000)")
    parser.add_argument("--no-tika", action="store_true", help="do not start the Tika server")
    parser.add_argument("--no-reload", action="store_true", help="disable API auto-reload")
    args = parser.parse_args()

    if IS_WINDOWS:
        os.system("")  # enables ANSI colours in the Windows console
        sys.stdout.reconfigure(encoding="utf-8")
    if port_open(args.port):
        say("launcher", f"Port {args.port} is already in use — is the API running somewhere else?")
        return 1

    services = build_services(args)
    for service in services:
        service.start()

    exit_code = 0
    try:
        if wait_until_ready(args.port):
            say("launcher", f"Backend ready → http://localhost:{args.port}/api/docs  ·  start the frontend with: npm run dev")
            say("launcher", "Press Ctrl+C to stop everything")
        while True:
            for service in services:
                if not service.running():
                    say("launcher", f"{service.name} exited (code {service.process.returncode}) — stopping the rest")
                    exit_code = 1
                    raise KeyboardInterrupt
            time.sleep(1)
    except KeyboardInterrupt:
        say("launcher", "Shutting down…")
    finally:
        for service in reversed(services):
            service.stop()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
