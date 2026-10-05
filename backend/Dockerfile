# syntax=docker/dockerfile:1.7
#
# X-tractor backend — two production images from one multi-stage file:
#   docker build --target api    -t premponnada/xtractor-api    .   (~200 MB: FastAPI only)
#   docker build --target worker -t premponnada/xtractor-worker .   (SDKs, OCR, LibreOffice, models)
#
# Stages: python-base → api-deps / worker-deps (build venvs) → models (download AI models)
#         → api / worker (slim runtimes: no compilers, no pip caches, non-root).

ARG PYTHON_IMAGE=python:3.12-slim-bookworm

# ---------------------------------------------------------------- base
FROM ${PYTHON_IMAGE} AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH

# ---------------------------------------------------------------- API dependencies
FROM python-base AS api-deps
RUN python -m venv /opt/venv
COPY requirements-api.txt /tmp/
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r /tmp/requirements-api.txt

# ---------------------------------------------------------------- worker dependencies
FROM python-base AS worker-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
COPY requirements-api.txt requirements.txt /tmp/
# The CPU index provides torch wheels without CUDA (~2 GB smaller). "+cpu" versions sort
# above the plain ones, so pip picks them for every package that depends on torch.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r /tmp/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu \
    && python -c "import torch; print('torch', torch.__version__)"
# Dependencies pull the desktop OpenCV build, which needs X11 libraries (libxcb) a server has
# not got. Swap it for the identical headless build of the same version.
RUN --mount=type=cache,target=/root/.cache/pip \
    OPENCV_VERSION="$(pip show opencv-python | sed -n 's/^Version: //p')" \
    && pip uninstall -y opencv-python \
    && pip install --force-reinstall --no-deps "opencv-python-headless==${OPENCV_VERSION}" \
    && python -c "import cv2; print('opencv', cv2.__version__, 'headless')"

# ---------------------------------------------------------------- AI models (baked in: no download at runtime)
FROM worker-deps AS models
ENV HF_HOME=/models/hf \
    DOCLING_ARTIFACTS_PATH=/models/docling
WORKDIR /build
COPY scripts/prepare_models.py scripts/
# One layer per download so a failure never repeats the other (Docling's is ~1 GB).
RUN python scripts/prepare_models.py --only docling
RUN python scripts/prepare_models.py --only unstructured

# ---------------------------------------------------------------- API runtime
FROM python-base AS api
LABEL org.opencontainers.image.title="xtractor-api" \
      org.opencontainers.image.description="X-tractor API (FastAPI): auth, jobs, results, live events" \
      org.opencontainers.image.source="https://github.com/premkumar-ponnada/X-tractor" \
      org.opencontainers.image.licenses="MIT"
RUN groupadd --system --gid 10001 xtractor \
    && useradd --system --uid 10001 --gid xtractor --create-home --home-dir /home/xtractor xtractor \
    && mkdir -p /data/storage && chown xtractor:xtractor /data/storage
COPY --from=api-deps /opt/venv /opt/venv
WORKDIR /app
COPY --chown=xtractor:xtractor . .
ENV XT_STORAGE_DIR=/data/storage
USER xtractor
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]

# ---------------------------------------------------------------- worker runtime
FROM python-base AS worker
LABEL org.opencontainers.image.title="xtractor-worker" \
      org.opencontainers.image.description="X-tractor extraction worker: Docling, Unstructured, MarkItDown, baseline; Tesseract (swe+eng) and LibreOffice" \
      org.opencontainers.image.source="https://github.com/premkumar-ponnada/X-tractor" \
      org.opencontainers.image.licenses="MIT"
# Runtime libraries only: OCR with Swedish, headless LibreOffice for legacy formats,
# Poppler/libmagic/OpenCV libs used by Unstructured and Docling, fonts for conversions.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-swe tesseract-ocr-eng \
        libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui \
        poppler-utils libmagic1 libgl1 libglib2.0-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 xtractor \
    && useradd --system --uid 10001 --gid xtractor --create-home --home-dir /home/xtractor xtractor \
    && mkdir -p /data/storage && chown xtractor:xtractor /data/storage
COPY --from=worker-deps /opt/venv /opt/venv
COPY --from=models --chown=xtractor:xtractor /models /models
WORKDIR /app
COPY --chown=xtractor:xtractor . .
ENV XT_STORAGE_DIR=/data/storage \
    XT_TESSERACT_CMD=tesseract \
    HF_HOME=/models/hf \
    DOCLING_ARTIFACTS_PATH=/models/docling \
    HF_HUB_OFFLINE=1 \
    OMP_NUM_THREADS=4
USER xtractor
# Healthy while the worker's heartbeat file is fresh (touched every ~10 s).
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import os,sys,time; f='/tmp/xtractor-worker.heartbeat'; sys.exit(0 if os.path.exists(f) and time.time()-os.path.getmtime(f) < 90 else 1)"
CMD ["python", "run_worker.py"]
