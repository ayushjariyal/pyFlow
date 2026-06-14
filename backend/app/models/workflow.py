"""Workflow orchestration models: Workflow, WorkflowTask, TaskDependency.

A Workflow is a DAG of WorkflowTasks connected by TaskDependency edges. Tasks
reuse the existing data-processing JobType executors; the scheduler advances the
DAG as tasks complete.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.job import JobType


class WorkflowStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"   # waiting on dependencies
    READY = "READY"       # dependencies satisfied, queued
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"   # an upstream failure / cancellation


_enum_values = lambda enum_cls: [m.value for m in enum_cls]  # noqa: E731


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[WorkflowStatus] = mapped_column(
        SAEnum(WorkflowStatus, name="workflow_status", values_callable=_enum_values),
        nullable=False,
        default=WorkflowStatus.PENDING,
        index=True,
    )
    # The uploaded input file (relative to storage) the pipeline runs on.
    input_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
        nullable=False,
    )

    tasks: Mapped[list["WorkflowTask"]] = relationship(
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowTask.created_at",
    )


class WorkflowTask(Base):
    __tablename__ = "workflow_tasks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # The caller-supplied node id within the workflow (e.g. "validate"); unique
    # per workflow and used to wire up dependencies.
    ref: Mapped[str] = mapped_column(String(255), nullable=False)

    task_type: Mapped[JobType] = mapped_column(
        SAEnum(JobType, name="job_type_enum", values_callable=_enum_values),
        nullable=False,
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="task_status", values_callable=_enum_values),
        nullable=False,
        default=TaskStatus.PENDING,
        index=True,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    execution_time: Mapped[float | None] = mapped_column(Float, nullable=True)

    input_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    retry_delay: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
        nullable=False,
    )

    workflow: Mapped["Workflow"] = relationship(back_populates="tasks")


class TaskDependency(Base):
    """A directed edge: parent must finish before child can run."""

    __tablename__ = "task_dependencies"

    parent_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_tasks.id", ondelete="CASCADE"), primary_key=True
    )
    child_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workflow_tasks.id", ondelete="CASCADE"), primary_key=True
    )
