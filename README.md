# X-tractor

**Run five document-extraction SDKs on the same files, watch every step live, and compare page-accurate output side by side.**

X-tractor is a test bench for the "files → AI-ready text" step of a document pipeline. Upload a tender package (PDFs, Office files, emails, scans, ZIP archives), pick the extractors, and get per-page Markdown, every native output format, quality metrics and a scored winner per file.

| Extractor | Approach | Output modes |
|---|---|---|
| **Docling** (IBM) | AI layout + table models, OCR where pages lack text | Markdown · JSON · HTML · Text · DocTags |
| **Unstructured** | Typed elements with page metadata, `fast` / `hi_res` | JSON · Text · HTML · Markdown |
| **Apache Tika** | Java REST server, 1000+ formats | Text · XHTML · Metadata JSON |
| **MarkItDown** (Microsoft) | Fast conversion to one Markdown string | Markdown |
| **Baseline** | pypdf · python-docx · openpyxl · xlrd · extract-msg | Text · JSON |

All five are free for commercial use (MIT / Apache-2.0 / BSD) and run fully inside your own environment.

## Features

- **Six-step flow, one page per step:** Upload → Configure → Extract (live) → Results → Compare → Report
- **Live timeline** over Server-Sent Events: file detection, ZIP unpacking, each SDK stage, warnings and failures, with resumable streams
- **Per-page output** in one normalised shape (`pages: [{n, text, tables, images}]`), so page numbers survive for citations
- **Every native format** an SDK produces, viewable rendered or as source, plus copy and download
- **Metrics** for each run: pages, % pages with text, words, tables, images, å/ä/ö count, broken characters, speed, whether page boundaries were kept
- **Scoring and report:** a relative quality score per file, a winner per file and an SDK leaderboard, with the weights shown in the UI
- **Side-by-side compare** of two SDKs on the same page, with word overlap
- **Partial failure is normal:** one corrupt file or crashing SDK never stops the job; runs time out, the pool restarts, and failed runs can be retried
- Light and dark theme, responsive layout, skeleton loaders and animations

## Architecture

```
React + Vite SPA ──REST + SSE──► FastAPI API ──► MongoDB  (jobs · runs · job_events · workers)
   (JavaScript)                      │ queue (status = queued)
                                     ▼
                              Worker process ──► process pool (one child per run, timeout + crash recovery)
                                     │              ├─ Docling · Unstructured · MarkItDown · Baseline (in-process)
                                     │              └─ Apache Tika (HTTP → Tika Server, Java)
                                     └─ writes events + metrics to MongoDB, outputs to storage (local disk → Azure Blob)
```

- **API and worker are separate processes.** Extraction is CPU/GPU heavy; the API stays fast. Workers claim jobs atomically (`find_one_and_update`), send heartbeats, and stale jobs are requeued, so you can run N workers.
- **Events** are appended with a per-job sequence number. The SSE endpoint streams after `Last-Event-ID`, which works with standalone MongoDB and any number of API instances.
- **Safety:** streaming uploads with size limits, magic-byte type detection, ZIP-bomb limits (entries, total size, ratio, depth), sandboxed HTML preview, httpOnly cookie sessions, login rate limiting, and production settings validated at startup.

```
X-tractor/
├── backend/                FastAPI + worker (Python 3.12)
│   ├── config/             settings (XT_* env vars)
│   ├── core/               db, security, storage, errors, JSON logging
│   ├── extractors/         one adapter per SDK + detection, zip safety, metrics, SDK profiles
│   ├── features/           auth · sdks · jobs · results · stats (routes / service / repository)
│   ├── worker/             job runner, process pool, child entrypoint
│   ├── scripts/            prepare_models.py
│   └── tests/              pytest + synthetic fixture generator
├── frontend/               React + Vite (JavaScript), Tailwind v4, TanStack Query, Motion, Recharts
│   └── src/{pages,layouts,components,hooks,context,lib,constants}
├── tools/tika/             Tika server jar (downloaded, not committed)
├── scripts/dev.ps1         start everything on Windows
└── docker-compose.yml
```

## Local setup (Windows)

Prerequisites: **Python 3.12**, **Node 20+**, **MongoDB** (running as a service), **Java 11+**, **Tesseract 5**. LibreOffice is optional; it is needed for `.doc` / `.ppt` / `.rtf`.

```powershell
# 1. Backend
cd backend
py -3.12 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\venv\Scripts\python.exe -m pip uninstall -y python-magic   # hangs on Windows without libmagic
copy .env.example .env                                       # then set XT_AUTH_EMAIL / XT_AUTH_PASSWORD / XT_JWT_SECRET
.\venv\Scripts\python.exe scripts\prepare_models.py          # one-time ~1 GB model download

# 2. Apache Tika server
curl.exe -L -o ..\tools\tika\tika-server-standard-3.3.2.jar https://archive.apache.org/dist/tika/3.3.2/tika-server-standard-3.3.2.jar

# 3. Frontend
cd ..\frontend
npm install
```

**Swedish OCR:** download [`swe.traineddata`](https://github.com/tesseract-ocr/tessdata_fast/raw/main/swe.traineddata) into `C:\Program Files\Tesseract-OCR\tessdata\` (needs admin). Without it, OCR falls back to English and å/ä/ö are misread, and the UI marks Swedish as "not installed".

**Run** everything with `powershell -ExecutionPolicy Bypass -File scripts\dev.ps1`, or start each service yourself:

| Service | Command (from its folder) | URL |
|---|---|---|
| Tika | `java -jar tika-server-standard-3.3.2.jar --port 9998` | :9998 |
| API | `.\venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload` | :8000 (docs at `/api/docs`) |
| Worker | `.\venv\Scripts\python.exe run_worker.py` | — |
| Web | `npm run dev` | **http://localhost:5173** |

## Docker

```bash
echo "XT_AUTH_PASSWORD=choose-one" > .env
echo "XT_JWT_SECRET=$(python -c 'import secrets;print(secrets.token_urlsafe(48))')" >> .env
docker compose up --build        # → http://localhost:8080
```

This starts MongoDB, Tika (with OCR), the API, the worker (Tesseract Swedish and LibreOffice are installed in the image) and nginx serving the SPA, which proxies `/api` with SSE-safe settings.

## API

All routes are under `/api` and need the session cookie, except `health` and `auth/login`. Interactive docs are at `/api/docs` when not running in production.

| Method | Path | |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` · GET `/auth/me` | session |
| GET | `/sdks` · `/sdks/{name}` | profiles, capabilities, formats, live availability |
| POST | `/jobs` (multipart: `files`, `sdks`, `ocr`, `tables`, `ocr_languages`, `name`) | create → 202 |
| GET | `/jobs` · `/jobs/{id}` · `/jobs/{id}/events` (SSE) · `/jobs/{id}/events/history` | |
| POST / DELETE | `/jobs/{id}/cancel` · `/jobs/{id}/retry` · `/jobs/{id}` | |
| GET | `/runs/{id}` · `/runs/{id}/pages` · `/runs/{id}/output?format=` · `/runs/{id}/download?format=` | |
| GET | `/jobs/{id}/compare?file_id=` · `/jobs/{id}/report` · `/stats/overview` · `/stats/sdks` · `/health` | |

## Quality checks

```powershell
cd backend;  .\venv\Scripts\python.exe -m pytest      # 29 tests (core + API, isolated test database)
             .\venv\Scripts\ruff.exe check . ; .\venv\Scripts\ruff.exe format --check .
cd frontend; npx oxlint ; npm run build
```

`python tests/make_fixtures.py` regenerates the synthetic test documents: a text PDF with Swedish characters, a scanned PDF, a DOCX with header, footer and table, an XLSX, a CSV, an EML and a nested ZIP.

## Roadmap

- Real user accounts (replacing the single `.env` login), then Entra ID
- Azure deployment: Container Apps (API, worker, Tika), Cosmos DB for MongoDB, Blob Storage, Static Web Apps
- Azure AI Document Intelligence as a sixth extractor for hard scans
- GPU worker profile for Docling
