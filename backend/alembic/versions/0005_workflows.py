"""workflow orchestration tables

Revision ID: 0005_workflows
Revises: 0004_data_platform
Create Date: 2026-06-14

Phase 6: adds workflows, workflow_tasks and task_dependencies for DAG-based
orchestration. Reuses the existing job_type_enum values for task types.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_workflows"
down_revision: Union[str, None] = "0004_data_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

workflow_status = sa.Enum(
    "PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED", name="workflow_status"
)
task_status = sa.Enum(
    "PENDING", "READY", "RUNNING", "SUCCESS", "FAILED", "SKIPPED", name="task_status"
)
job_type = sa.Enum(
    "CSV_ANALYSIS", "DATA_CLEANING", "FILE_CONVERSION",
    "DATA_PROFILE_REPORT", "BULK_DATA_VALIDATION",
    name="job_type_enum",
    create_type=False,  # already exists from earlier migrations
)


def upgrade() -> None:
    op.create_table(
        "workflows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", workflow_status, nullable=False, server_default="PENDING"),
        sa.Column("input_file_path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflows_status", "workflows", ["status"])
    op.create_index("ix_workflows_created_at", "workflows", ["created_at"])

    op.create_table(
        "workflow_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workflow_id", sa.Uuid(), nullable=False),
        sa.Column("ref", sa.String(length=255), nullable=False),
        sa.Column("task_type", job_type, nullable=False),
        sa.Column("status", task_status, nullable=False, server_default="PENDING"),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("execution_time", sa.Float(), nullable=True),
        sa.Column("input_file_path", sa.String(length=512), nullable=True),
        sa.Column("output_file_path", sa.String(length=512), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("retry_delay", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_tasks_workflow_id", "workflow_tasks", ["workflow_id"])
    op.create_index("ix_workflow_tasks_status", "workflow_tasks", ["status"])

    op.create_table(
        "task_dependencies",
        sa.Column("parent_task_id", sa.Uuid(), nullable=False),
        sa.Column("child_task_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["parent_task_id"], ["workflow_tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["child_task_id"], ["workflow_tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("parent_task_id", "child_task_id"),
    )


def downgrade() -> None:
    op.drop_table("task_dependencies")
    op.drop_index("ix_workflow_tasks_status", table_name="workflow_tasks")
    op.drop_index("ix_workflow_tasks_workflow_id", table_name="workflow_tasks")
    op.drop_table("workflow_tasks")
    op.drop_index("ix_workflows_created_at", table_name="workflows")
    op.drop_index("ix_workflows_status", table_name="workflows")
    op.drop_table("workflows")
    task_status.drop(op.get_bind(), checkfirst=True)
    workflow_status.drop(op.get_bind(), checkfirst=True)
