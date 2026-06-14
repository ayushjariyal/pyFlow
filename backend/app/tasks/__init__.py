"""Tasks package.

Re-exports `process_job` so existing imports (`from app.tasks import process_job`)
keep working now that tasks live in a package instead of a single module.
"""

from app.tasks.runner import process_job

__all__ = ["process_job"]
