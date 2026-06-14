"""ORM models package.

Importing the models here ensures they are registered on `Base.metadata`,
which is what Alembic's autogenerate inspects.
"""

from app.models.job import Job, JobStatus, JobType
from app.models.workflow import (
    TaskDependency,
    TaskStatus,
    Workflow,
    WorkflowStatus,
    WorkflowTask,
)

__all__ = [
    "Job",
    "JobStatus",
    "JobType",
    "Workflow",
    "WorkflowTask",
    "TaskDependency",
    "WorkflowStatus",
    "TaskStatus",
]
