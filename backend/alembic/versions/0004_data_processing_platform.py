"""data-processing platform: new job types + file/metadata columns

Revision ID: 0004_data_platform
Revises: 0003_job_type
Create Date: 2026-06-13

Phase 5: transform demo jobs into data-processing jobs.
  * Drops legacy demo rows (FACTORIAL / PRIME_COUNT / WORD_COUNT).
  * Redefines the job_type enum to the data-processing types.
  * Adds input_file_path, output_file_path, job_metadata.

Batch mode is used because SQLite recreates the table to change the enum CHECK
constraint and add columns.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_data_platform"
down_revision: Union[str, None] = "0003_job_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TYPES = (
    "CSV_ANALYSIS",
    "DATA_CLEANING",
    "FILE_CONVERSION",
    "DATA_PROFILE_REPORT",
    "BULK_DATA_VALIDATION",
)
OLD_DEMO_TYPES = ("FACTORIAL", "PRIME_COUNT", "WORD_COUNT")

new_enum = sa.Enum(*NEW_TYPES, name="job_type_enum")
old_enum = sa.Enum(*OLD_DEMO_TYPES, "CSV_ANALYSIS", name="job_type_enum")


def upgrade() -> None:
    # Legacy demo jobs can't satisfy the new enum's CHECK constraint; drop them.
    placeholders = ", ".join(f"'{t}'" for t in OLD_DEMO_TYPES)
    op.execute(f"DELETE FROM jobs WHERE job_type IN ({placeholders})")

    with op.batch_alter_table("jobs") as batch_op:
        batch_op.alter_column(
            "job_type",
            type_=new_enum,
            existing_type=sa.String(length=12),
            existing_nullable=False,
            server_default=None,  # drop the temporary default from 0003
        )
        batch_op.add_column(
            sa.Column("input_file_path", sa.String(length=512), nullable=True)
        )
        batch_op.add_column(
            sa.Column("output_file_path", sa.String(length=512), nullable=True)
        )
        batch_op.add_column(sa.Column("job_metadata", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.drop_column("job_metadata")
        batch_op.drop_column("output_file_path")
        batch_op.drop_column("input_file_path")
        batch_op.alter_column(
            "job_type",
            type_=old_enum,
            existing_type=new_enum,
            existing_nullable=False,
            server_default="WORD_COUNT",
        )
