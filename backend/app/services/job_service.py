"""Business logic for jobs (DB operations + enqueuing).

Routers handle HTTP, this service handles "what the application does", and the
ORM handles storage. The heavy data work lives in the per-type service modules
(csv_analysis, data_cleaning, ...) invoked by the Celery worker.
"""

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job, JobStatus, JobType
from app.schemas.payloads import validate_payload
from app.tasks import process_job

logger = logging.getLogger(__name__)


class JobService:
    """Encapsulates all read/write operations for jobs."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create_processing_job(
        self,
        *,
        job_type: JobType,
        input_file_path: str,
        options: dict,
        original_filename: str | None = None,
    ) -> Job:
        """Validate options, persist a PENDING job, and enqueue it.

        Used by both the upload endpoint (file just stored) and the JSON create
        endpoint (referencing an already-uploaded file).
        """
        normalized = validate_payload(job_type, options)
        job = Job(
            task_name=original_filename or job_type.value,
            job_type=job_type,
            payload=normalized,
            status=JobStatus.PENDING,
            input_file_path=input_file_path,
            job_metadata={"original_filename": original_filename},
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        logger.info(
            "job created id=%s type=%s input=%s",
            job.id,
            job_type.value,
            input_file_path,
        )

        self._enqueue(job)
        return job

    def get_job(self, job_id: uuid.UUID) -> Job | None:
        return self.db.get(Job, job_id)

    def list_jobs(self, skip: int = 0, limit: int = 100) -> list[Job]:
        stmt = (
            select(Job)
            .order_by(Job.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def retry_job(self, job: Job) -> Job:
        """Re-enqueue a previously-FAILED job against the same input file."""
        job.status = JobStatus.PENDING
        job.result = None
        job.output_file_path = None
        job.execution_time = None
        self.db.commit()
        self.db.refresh(job)

        self._enqueue(job)
        logger.info("job %s re-enqueued for retry", job.id)
        return job

    def _enqueue(self, job: Job) -> None:
        """Dispatch the Celery task and persist its task id."""
        async_result = process_job.delay(str(job.id))
        job.celery_task_id = async_result.id
        self.db.commit()
        self.db.refresh(job)
        logger.info(
            "job %s enqueued (celery_task_id=%s)", job.id, job.celery_task_id
        )
