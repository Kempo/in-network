# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/playwright/python:v1.60.0-noble
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev
RUN uv run playwright install chromium
COPY . .
EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
