"""Job ORM model, plus the JobStatus and JobType enums."""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class JobStatus(str, enum.Enum):
    """Lifecycle states a job can be in.

    Inheriting from `str` makes the enum JSON-serialisable and means the values
    are stored/compared as plain strings ("PENDING", ...).
    """

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class JobType(str, enum.Enum):
    """Data-processing workloads. Every type operates on an uploaded CSV file."""

    CSV_ANALYSIS = "CSV_ANALYSIS"
    DATA_CLEANING = "DATA_CLEANING"
    FILE_CONVERSION = "FILE_CONVERSION"
    DATA_PROFILE_REPORT = "DATA_PROFILE_REPORT"
    BULK_DATA_VALIDATION = "BULK_DATA_VALIDATION"


class Job(Base):
    __tablename__ = "jobs"

    # UUID primary keys avoid leaking row counts and make IDs safe to expose and
    # generate client-side. Generated in Python so the value is available before
    # the row is flushed. `sa.Uuid` is dialect-agnostic: native UUID on
    # PostgreSQL, CHAR(32) on SQLite.
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    # A human-friendly label for the job. Optional on the API; the service
    # defaults it to the job_type when omitted (kept NOT NULL for stable sorting/
    # display). Distinct from `job_type`, which selects the executor.
    task_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Which real workload to run (FACTORIAL, PRIME_COUNT, ...). Drives executor
    # dispatch in the worker. Indexed so jobs can be filtered/grouped by type.
    job_type: Mapped[JobType] = mapped_column(
        SAEnum(
            JobType,
            name="job_type_enum",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        index=True,
    )

    # Validated job options/config (e.g. {"output_format": "xlsx"}). Stored as
    # JSON so each job type can have its own shape. The actual *data* lives in
    # the uploaded file, not here.
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )

    # Path (relative to the storage base) of the uploaded input file.
    input_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Path (relative to the storage base) of the generated output file, if any
    # (cleaned CSV, converted file, HTML/JSON report).
    output_file_path: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )

    # Free-form metadata about the job (e.g. original filename, sizes). Distinct
    # from `result`, which holds the computed report. NOTE: not named `metadata`
    # because SQLAlchemy reserves that attribute on declarative models.
    job_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )

    # Stored as a native PostgreSQL ENUM type, named so migrations can reference
    # it. `values_callable` makes SQLAlchemy persist the enum *values* (rather
    # than relying on member names), which keeps the DB representation explicit
    # and stable if names and values ever diverge.
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(
            JobStatus,
            name="job_status",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        nullable=False,
        default=JobStatus.PENDING,
        server_default=JobStatus.PENDING.value,
        index=True,
    )

    # The job's output as structured JSON, set by the worker on completion
    # (e.g. {"prime_count": 9592}) or {"error": "..."} on failure. Nullable
    # because a freshly created job has no result yet.
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Wall-clock seconds the executor took, recorded by the worker. Nullable
    # until the job has run.
    execution_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    # The id of the Celery task processing this job. Nullable because it's only
    # set once the task has been enqueued; indexed so a task can be correlated
    # back to its job if needed.
    celery_task_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )

    # Timezone-aware timestamps set by the database (`server_default`/`onupdate`)
    # so they are consistent regardless of the app server's clock. `created_at`
    # is indexed because list queries order by it (newest-first).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid only
        return (
            f"<Job id={self.id} job_type={self.job_type} status={self.status}>"
        )
