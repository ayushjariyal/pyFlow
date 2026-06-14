#!/usr/bin/env bash
# Start command for a single-container deploy (e.g. Render free tier).
# Runs DB migrations, then the Celery worker and the API in the same container.
# On a paid setup you'd split these into separate services.
set -e

cd "$(dirname "$0")"   # -> backend/

# Apply migrations (idempotent — safe to run on every boot).
alembic upgrade head

# Background worker. concurrency=1 keeps memory low for small free instances.
celery -A app.celery_app worker --loglevel=info --concurrency=1 &

# Foreground web server. Render/most PaaS provide $PORT.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
