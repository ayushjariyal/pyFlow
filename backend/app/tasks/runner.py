"""The Celery task that runs data-processing jobs.

This is the only Celery-aware module in the package. It owns persistence and the
PENDING -> RUNNING -> SUCCESS/FAILED lifecycle, resolves the job's input file
from storage, and dispatches to the matching service module. It runs in the
worker process and uses its own DB session via `session_scope()`.
"""

import logging
import time
import uuid

from app import storage
from app.celery_app import celery_app
from app.database import session_scope
from app.models.job import Job, JobStatus
from app.tasks.dispatch import dispatch

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.process_job", bind=True)
def process_job(self, job_id: str) -> dict:
    """Execute a data-processing job by dispatching on its job_type."""
    task_id = self.request.id
    logger.info("worker started job_id=%s task_id=%s", job_id, task_id)

    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        logger.error("invalid job_id: %r", job_id)
        return {"job_id": job_id, "status": "INVALID_ID"}

    # --- Mark RUNNING and capture inputs --------------------------------------
    with session_scope() as db:
        job = db.get(Job, job_uuid)
        if job is None:
            logger.error("job %s not found", job_id)
            return {"job_id": job_id, "status": "NOT_FOUND"}
        job.status = JobStatus.RUNNING
        job.celery_task_id = task_id
        db.commit()
        job_type = job.job_type
        options = dict(job.payload or {})
        input_rel = job.input_file_path
        logger.info("job %s (%s) -> RUNNING", job_id, job_type.value)

    # --- Run the workload -----------------------------------------------------
    start = time.perf_counter()
    try:
        if not input_rel:
            raise ValueError("job has no input file")
        input_abs = storage.resolve(input_rel)
        if not input_abs.exists():
            raise FileNotFoundError(f"input file missing: {input_rel}")

        result, output_rel = dispatch(job_type, input_abs, options)
        elapsed = time.perf_counter() - start

        with session_scope() as db:
            job = db.get(Job, job_uuid)
            if job is None:
                logger.error("job %s vanished mid-flight", job_id)
                return {"job_id": job_id, "status": "NOT_FOUND"}
            job.status = JobStatus.SUCCESS
            job.result = result
            job.output_file_path = output_rel
            job.execution_time = elapsed
            db.commit()

        logger.info(
            "job %s -> SUCCESS in %.3fs (output=%s)", job_id, elapsed, output_rel
        )
        return {"job_id": job_id, "status": JobStatus.SUCCESS.value}

    except Exception as exc:  # noqa: BLE001 - any failure marks the job FAILED
        elapsed = time.perf_counter() - start
        logger.exception("job %s -> FAILED: %s", job_id, exc)
        with session_scope() as db:
            job = db.get(Job, job_uuid)
            if job is not None:
                job.status = JobStatus.FAILED
                job.result = {"error": str(exc)}
                job.execution_time = elapsed
                db.commit()
        raise
