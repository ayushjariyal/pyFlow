"""add celery_task_id to jobs

Revision ID: 0002_celery_task_id
Revises: 0001_initial
Create Date: 2026-06-13

Phase 2: adds the nullable `celery_task_id` column linking a job to the Celery
task that processes it, plus an index for correlation lookups.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_celery_task_id"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_jobs_celery_task_id", "jobs", ["celery_task_id"])


def downgrade() -> None:
    op.drop_index("ix_jobs_celery_task_id", table_name="jobs")
    op.drop_column("jobs", "celery_task_id")
