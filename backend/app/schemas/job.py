"""Pydantic schemas for the Job resource.

These define the API's external contract and are deliberately separate from the
ORM model so that the database schema can evolve independently of the API.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.job import JobStatus, JobType


class JobCreate(BaseModel):
    """Request body for POST /jobs — create a job for an already-uploaded file.

    `input_file_path` is the relative storage path returned by POST /jobs/upload.
    `payload` carries per-type options (validated in the service layer; invalid
    options -> HTTP 400). Use POST /jobs/upload to upload + create in one step.
    """

    job_type: JobType = Field(..., examples=["CSV_ANALYSIS"])
    input_file_path: str = Field(
        ...,
        description="Relative storage path of a previously uploaded file.",
        examples=["uploads/ab12cd_data.csv"],
    )
    payload: dict[str, Any] = Field(
        default_factory=dict, description="Per-type options."
    )


class JobRead(BaseModel):
    """Response body representing a stored job."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_name: str
    job_type: JobType
    payload: dict[str, Any]
    status: JobStatus
    result: dict[str, Any] | None
    execution_time: float | None
    input_file_path: str | None
    output_file_path: str | None
    job_metadata: dict[str, Any] | None
    celery_task_id: str | None
    created_at: datetime
    updated_at: datetime


class JobStatusResponse(BaseModel):
    """Lightweight response for the dedicated status endpoint."""

    model_config = ConfigDict(from_attributes=True)

    job_id: uuid.UUID
    job_type: JobType
    status: JobStatus
    execution_time: float | None
    celery_task_id: str | None
