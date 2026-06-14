"""Celery application instance.

This is the entrypoint the worker is started against:

    celery -A app.celery_app worker --loglevel=info

The web process imports the same `celery_app` to enqueue tasks (`.delay(...)`),
so both sides share one configuration. Redis is used as the broker (the task
queue) and as the result backend (task state/results).
"""

from celery import Celery

from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()

celery_app = Celery(
    "job_platform",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    # `include` tells the worker which modules to import so the @task functions
    # are registered: standalone jobs + workflow tasks.
    include=["app.tasks.runner", "app.workers.workflow_worker"],
)

celery_app.conf.update(
    # Record a STARTED state when a worker picks up a task (useful for debugging).
    task_track_started=True,
    # Serialize task payloads as JSON (safe, language-agnostic).
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Store timestamps in UTC.
    timezone="UTC",
    enable_utc=True,
    # Don't silently lose a task if a worker is killed mid-execution: only
    # acknowledge it once it has finished.
    task_acks_late=True,
)
