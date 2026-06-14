"""Pydantic schemas for workflows."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.job import JobType
from app.models.workflow import TaskStatus, WorkflowStatus


# --- Create request -------------------------------------------------------
class TaskDefinition(BaseModel):
    id: str = Field(..., description="Node id, unique within the workflow.")
    type: JobType
    payload: dict[str, Any] = Field(default_factory=dict)
    max_retries: int = Field(default=0, ge=0, le=10)
    retry_delay: int = Field(default=0, ge=0, le=3600, description="seconds")


class DependencyDefinition(BaseModel):
    # `from` is a Python keyword, so accept it via alias.
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(..., alias="from")
    to: str


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    tasks: list[TaskDefinition] = Field(..., min_length=1)
    dependencies: list[DependencyDefinition] = Field(default_factory=list)


# --- Read responses -------------------------------------------------------
class WorkflowTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ref: str
    task_type: JobType
    status: TaskStatus
    payload: dict[str, Any]
    result: dict[str, Any] | None
    execution_time: float | None
    input_file_path: str | None
    output_file_path: str | None
    retry_count: int
    max_retries: int
    retry_delay: int
    created_at: datetime
    updated_at: datetime


class EdgeRead(BaseModel):
    from_: str = Field(..., serialization_alias="from")
    to: str


class WorkflowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    status: WorkflowStatus
    input_file_path: str | None
    created_at: datetime
    updated_at: datetime
    tasks: list[WorkflowTaskRead]
    dependencies: list[EdgeRead]


class WorkflowSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: WorkflowStatus
    created_at: datetime
    updated_at: datetime
    task_count: int


class WorkflowMetrics(BaseModel):
    total: int
    running: int
    completed: int
    failed: int
    pending: int
    cancelled: int
    success_rate: float
    failure_rate: float
    avg_completion_seconds: float | None
