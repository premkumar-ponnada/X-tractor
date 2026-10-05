# One image for both the API and the worker (different commands, see docker-compose.yml).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models \
    XT_STORAGE_DIR=/data/storage \
    XT_TESSERACT_CMD=tesseract

# OCR (Swedish + English), LibreOffice for legacy Office formats, Poppler/libmagic/OpenCV runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-swe tesseract-ocr-eng \
        libreoffice-writer libreoffice-calc libreoffice-impress \
        poppler-utils libmagic1 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# CPU-only torch keeps the image ~2 GB smaller than the default CUDA build.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision \
    && pip install -r requirements.txt

COPY . .
RUN useradd --create-home --uid 10001 xtractor \
    && mkdir -p /data/storage /models \
    && chown -R xtractor /app /data /models
USER xtractor

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
