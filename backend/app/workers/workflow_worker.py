"""Celery task that executes a single workflow task (DAG node).

It runs the same data-processing dispatch as standalone jobs, then calls back
into the scheduler engine to advance the DAG (promote children / retry / fail).
Runs in the worker process with its own DB session.
"""

import logging
import time
import uuid

from app import storage
from app.celery_app import celery_app
from app.database import session_scope
from app.models.workflow import TaskStatus, WorkflowStatus, WorkflowTask
from app.scheduler import engine
from app.tasks.dispatch import dispatch

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.run_workflow_task", bind=True)
def run_workflow_task(self, task_id: str) -> dict:
    """Execute one workflow task and advance the workflow."""
    try:
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        logger.error("invalid workflow task id: %r", task_id)
        return {"task_id": task_id, "status": "INVALID_ID"}

    # --- Mark RUNNING (unless the workflow was cancelled/failed meanwhile) -----
    with session_scope() as db:
        task = db.get(WorkflowTask, task_uuid)
        if task is None:
            logger.error("workflow task %s not found", task_id)
            return {"task_id": task_id, "status": "NOT_FOUND"}
        workflow = task.workflow
        if workflow.status != WorkflowStatus.RUNNING:
            task.status = TaskStatus.SKIPPED
            db.commit()
            logger.info("task %s skipped (workflow %s)", task.ref, workflow.status.value)
            return {"task_id": task_id, "status": "SKIPPED"}
        task.status = TaskStatus.RUNNING
        task.celery_task_id = self.request.id
        db.commit()
        job_type = task.task_type
        options = dict(task.payload or {})
        input_rel = task.input_file_path
        ref = task.ref
        logger.info("workflow task %s (%s) -> RUNNING", ref, job_type.value)

    # --- Execute --------------------------------------------------------------
    start = time.perf_counter()
    try:
        if not input_rel:
            raise ValueError("task has no input file")
        input_abs = storage.resolve(input_rel)
        if not input_abs.exists():
            raise FileNotFoundError(f"input file missing: {input_rel}")

        result, output_rel = dispatch(job_type, input_abs, options)
        elapsed = time.perf_counter() - start

        with session_scope() as db:
            engine.handle_task_success(db, task_uuid, result, output_rel, elapsed)
        return {"task_id": task_id, "status": "SUCCESS"}

    except Exception as exc:  # noqa: BLE001 - any failure routes through the engine
        elapsed = time.perf_counter() - start
        logger.exception("workflow task %s failed: %s", ref, exc)
        with session_scope() as db:
            engine.handle_task_failure(db, task_uuid, str(exc), elapsed)
        return {"task_id": task_id, "status": "FAILED"}
