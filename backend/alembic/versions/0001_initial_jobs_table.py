"""initial jobs table

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-13

Creates the `jobs` table. Written with dialect-agnostic SQLAlchemy types so the
same migration runs on both SQLite (the zero-setup default) and PostgreSQL:
  * `sa.Uuid`  -> native UUID on Postgres, CHAR(32) on SQLite.
  * `sa.Enum`  -> native ENUM on Postgres, VARCHAR + CHECK on SQLite.
  * `sa.func.now()` -> `now()` on Postgres, `CURRENT_TIMESTAMP` on SQLite.

Future changes should be created with `alembic revision --autogenerate`.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum reused in upgrade/downgrade. On Postgres this maps to a named ENUM type;
# on SQLite it becomes a CHECK constraint and the type drop is a harmless no-op.
job_status = sa.Enum(
    "PENDING",
    "RUNNING",
    "SUCCESS",
    "FAILED",
    name="job_status",
)


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            job_status,
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jobs_task_name", "jobs", ["task_name"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    # Indexed because list queries order by created_at (newest-first).
    op.create_index("ix_jobs_created_at", "jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_created_at", table_name="jobs")
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_index("ix_jobs_task_name", table_name="jobs")
    op.drop_table("jobs")
    # No-op on SQLite; drops the ENUM type on PostgreSQL.
    job_status.drop(op.get_bind(), checkfirst=True)
