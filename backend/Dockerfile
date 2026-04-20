FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV POETRY_VERSION=2.2.1
ENV POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "poetry==$POETRY_VERSION"

COPY pyproject.toml poetry.lock README.md ./
COPY app ./app
COPY scripts ./scripts
COPY alembic ./alembic
COPY alembic.ini ./

RUN poetry install --only main --no-interaction --no-ansi

EXPOSE 8000
