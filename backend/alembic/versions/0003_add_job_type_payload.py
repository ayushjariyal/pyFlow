"""add job_type, payload, execution_time; result -> JSON

Revision ID: 0003_job_type
Revises: 0002_celery_task_id
Create Date: 2026-06-13

Phase 3: jobs now run real, typed workloads. Adds:
  * job_type       — which workload to run (enum)
  * payload        — JSON input for the workload
  * execution_time — seconds the worker took
and converts `result` from TEXT to JSON.

Uses batch mode because SQLite can't ALTER columns / add enum CHECK constraints
in place — Alembic recreates the table transparently. `server_default`s are
included so the migration is safe even on a populated table; the application
always supplies these values explicitly.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_job_type"
down_revision: Union[str, None] = "0002_celery_task_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

job_type_enum = sa.Enum(
    "FACTORIAL",
    "PRIME_COUNT",
    "WORD_COUNT",
    "CSV_ANALYSIS",
    name="job_type_enum",
)


def upgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "job_type",
                job_type_enum,
                nullable=False,
                server_default="WORD_COUNT",
            )
        )
        batch_op.add_column(
            sa.Column(
                "payload",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'{}'"),
            )
        )
        batch_op.add_column(
            sa.Column("execution_time", sa.Float(), nullable=True)
        )
        batch_op.alter_column(
            "result",
            type_=sa.JSON(),
            existing_type=sa.Text(),
            existing_nullable=True,
        )
        batch_op.create_index("ix_jobs_job_type", ["job_type"])


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.drop_index("ix_jobs_job_type")
        batch_op.alter_column(
            "result",
            type_=sa.Text(),
            existing_type=sa.JSON(),
            existing_nullable=True,
        )
        batch_op.drop_column("execution_time")
        batch_op.drop_column("payload")
        batch_op.drop_column("job_type")
