FROM python:3.11-bookworm

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tesseract-ocr tesseract-ocr-eng && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --upgrade pip && pip install uv

COPY pyproject.toml uv.lock /app/

RUN uv sync --frozen --no-install-project --no-dev

COPY . /app/

EXPOSE 2101

ENTRYPOINT ["/app/.venv/bin/uvicorn"]

CMD ["app.main:app", "--host", "0.0.0.0", "--port", "2101", "--workers", "1"]
