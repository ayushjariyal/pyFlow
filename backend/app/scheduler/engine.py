"""Workflow execution engine (the scheduler).

Owns the DAG lifecycle: create, run, advance-on-success, retry/fail, cancel, and
metrics. All orchestration logic lives here — routers and workers call into it,
never the other way around for business rules. Functions take an explicit DB
session so they work from both the web process and the worker process.

Tasks are dispatched by name via Celery (`app.workers.run_workflow_task`) to
avoid importing the worker module here (which would create an import cycle).
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.models.workflow import (
    TaskDependency,
    TaskStatus,
    Workflow,
    WorkflowStatus,
    WorkflowTask,
)
from app.scheduler.dag import validate_dag
from app.schemas.payloads import validate_payload
from app.schemas.workflow import WorkflowCreate

logger = logging.getLogger(__name__)


# --- graph helpers --------------------------------------------------------
def _parents(db: Session, task_id) -> list[WorkflowTask]:
    stmt = (
        select(WorkflowTask)
        .join(TaskDependency, TaskDependency.parent_task_id == WorkflowTask.id)
        .where(TaskDependency.child_task_id == task_id)
    )
    return list(db.scalars(stmt).all())


def _children(db: Session, task_id) -> list[WorkflowTask]:
    stmt = (
        select(WorkflowTask)
        .join(TaskDependency, TaskDependency.child_task_id == WorkflowTask.id)
        .where(TaskDependency.parent_task_id == task_id)
    )
    return list(db.scalars(stmt).all())


def _tasks(db: Session, workflow_id) -> list[WorkflowTask]:
    return list(
        db.scalars(
            select(WorkflowTask).where(WorkflowTask.workflow_id == workflow_id)
        ).all()
    )


def get_workflow_edges(db: Session, workflow: Workflow) -> list[dict]:
    """Return dependency edges as {from: parent_ref, to: child_ref}."""
    id_to_ref = {t.id: t.ref for t in workflow.tasks}
    edges = db.scalars(
        select(TaskDependency).where(
            TaskDependency.parent_task_id.in_(id_to_ref.keys())
        )
    ).all()
    return [
        {"from_": id_to_ref[e.parent_task_id], "to": id_to_ref[e.child_task_id]}
        for e in edges
    ]


# --- lifecycle ------------------------------------------------------------
def create_workflow(db: Session, data: WorkflowCreate) -> Workflow:
    """Validate the DAG + options, then persist the workflow and its tasks."""
    refs = [t.id for t in data.tasks]
    edges = [(d.from_, d.to) for d in data.dependencies]
    validate_dag(refs, edges)  # raises DagValidationError -> 400

    workflow = Workflow(
        name=data.name,
        description=data.description,
        status=WorkflowStatus.PENDING,
    )
    db.add(workflow)
    db.flush()  # assign workflow.id

    ref_to_task: dict[str, WorkflowTask] = {}
    for t in data.tasks:
        options = validate_payload(t.type, t.payload or {})  # raises -> 400
        task = WorkflowTask(
            workflow_id=workflow.id,
            ref=t.id,
            task_type=t.type,
            payload=options,
            status=TaskStatus.PENDING,
            max_retries=t.max_retries,
            retry_delay=t.retry_delay,
        )
        db.add(task)
        db.flush()
        ref_to_task[t.id] = task

    for d in data.dependencies:
        db.add(
            TaskDependency(
                parent_task_id=ref_to_task[d.from_].id,
                child_task_id=ref_to_task[d.to].id,
            )
        )

    db.commit()
    db.refresh(workflow)
    logger.info("workflow created id=%s name=%r tasks=%d", workflow.id, workflow.name, len(refs))
    return workflow


def run_workflow(db: Session, workflow: Workflow, input_file_path: str) -> Workflow:
    """Start a PENDING workflow: dispatch all root (dependency-free) tasks."""
    workflow.status = WorkflowStatus.RUNNING
    workflow.input_file_path = input_file_path
    db.commit()
    logger.info("workflow %s RUNNING (input=%s)", workflow.id, input_file_path)

    roots = [t for t in _tasks(db, workflow.id) if not _parents(db, t.id)]
    for task in roots:
        task.input_file_path = input_file_path
        _dispatch_task(db, task)
    return workflow


def cancel_workflow(db: Session, workflow: Workflow) -> Workflow:
    """Cancel a PENDING/RUNNING workflow; skip its not-yet-finished tasks."""
    if workflow.status not in (WorkflowStatus.PENDING, WorkflowStatus.RUNNING):
        return workflow
    workflow.status = WorkflowStatus.CANCELLED
    for task in _tasks(db, workflow.id):
        if task.status in (TaskStatus.PENDING, TaskStatus.READY):
            task.status = TaskStatus.SKIPPED
        elif task.status == TaskStatus.RUNNING and task.celery_task_id:
            # Best-effort: ask the worker to stop (it also guards on workflow status).
            celery_app.control.revoke(task.celery_task_id, terminate=False)
    db.commit()
    logger.info("workflow %s CANCELLED", workflow.id)
    return workflow


# --- task lifecycle (called by the worker) --------------------------------
def handle_task_success(
    db: Session, task_id, result: dict, output_rel: str | None, elapsed: float
) -> None:
    task = db.get(WorkflowTask, task_id)
    if task is None:
        return
    task.status = TaskStatus.SUCCESS
    task.result = result
    task.output_file_path = output_rel
    task.execution_time = elapsed
    db.commit()
    logger.info("task %s (%s) SUCCESS in %.3fs", task.ref, task.task_type.value, elapsed)

    workflow = db.get(Workflow, task.workflow_id)
    if workflow is None or workflow.status != WorkflowStatus.RUNNING:
        return  # cancelled/failed elsewhere — stop advancing

    # Promote any child whose dependencies are now all satisfied.
    for child in _children(db, task.id):
        if child.status != TaskStatus.PENDING:
            continue
        parents = _parents(db, child.id)
        if all(p.status == TaskStatus.SUCCESS for p in parents):
            child.input_file_path = _resolve_child_input(parents, workflow)
            _dispatch_task(db, child)

    _maybe_complete(db, workflow)


def handle_task_failure(db: Session, task_id, error: str, elapsed: float) -> None:
    task = db.get(WorkflowTask, task_id)
    if task is None:
        return
    workflow = db.get(Workflow, task.workflow_id)

    # Automatic retry, if configured and budget remains.
    if task.retry_count < task.max_retries:
        task.retry_count += 1
        db.commit()
        logger.info(
            "task %s retry %d/%d (delay=%ss)",
            task.ref, task.retry_count, task.max_retries, task.retry_delay,
        )
        _dispatch_task(db, task, countdown=task.retry_delay)
        return

    task.status = TaskStatus.FAILED
    task.result = {"error": error}
    task.execution_time = elapsed
    db.commit()
    logger.warning("task %s FAILED: %s", task.ref, error)

    # A failed task fails the whole workflow; skip everything not yet finished.
    if workflow is not None and workflow.status == WorkflowStatus.RUNNING:
        workflow.status = WorkflowStatus.FAILED
        for other in _tasks(db, workflow.id):
            if other.status in (TaskStatus.PENDING, TaskStatus.READY):
                other.status = TaskStatus.SKIPPED
        db.commit()
        logger.warning("workflow %s FAILED", workflow.id)


# --- internals ------------------------------------------------------------
def _dispatch_task(db: Session, task: WorkflowTask, countdown: int = 0) -> None:
    """Mark a task READY and enqueue it on Celery (parallel by default)."""
    # Lazy import to avoid an import cycle (worker imports this engine). Using the
    # task object's apply_async — not celery_app.send_task — so that eager mode
    # (used in tests) actually runs the task inline.
    from app.workers.workflow_worker import run_workflow_task

    task.status = TaskStatus.READY
    db.commit()
    async_result = run_workflow_task.apply_async(
        args=[str(task.id)], countdown=countdown
    )
    task.celery_task_id = async_result.id
    db.commit()
    logger.info("task %s (%s) dispatched -> READY", task.ref, task.task_type.value)


def _resolve_child_input(parents: list[WorkflowTask], workflow: Workflow) -> str | None:
    """A child consumes the first parent that produced an output file, else the
    workflow's original input file."""
    for parent in parents:
        if parent.output_file_path:
            return parent.output_file_path
    return workflow.input_file_path


def _maybe_complete(db: Session, workflow: Workflow) -> None:
    statuses = [t.status for t in _tasks(db, workflow.id)]
    if statuses and all(s == TaskStatus.SUCCESS for s in statuses):
        workflow.status = WorkflowStatus.COMPLETED
        db.commit()
        logger.info("workflow %s COMPLETED", workflow.id)


# --- monitoring -----------------------------------------------------------
def compute_metrics(db: Session) -> dict:
    counts = dict(
        db.execute(
            select(Workflow.status, func.count()).group_by(Workflow.status)
        ).all()
    )

    def n(status: WorkflowStatus) -> int:
        return int(counts.get(status, 0))

    completed, failed = n(WorkflowStatus.COMPLETED), n(WorkflowStatus.FAILED)
    finished = completed + failed
    total = sum(int(v) for v in counts.values())

    # Average wall-clock completion time over COMPLETED workflows. Compute the
    # delta in Python (portable across DBs) rather than subtracting in SQL.
    rows = db.execute(
        select(Workflow.created_at, Workflow.updated_at).where(
            Workflow.status == WorkflowStatus.COMPLETED
        )
    ).all()
    secs = [(u - c).total_seconds() for c, u in rows if c and u]
    avg_completion = round(sum(secs) / len(secs), 3) if secs else None

    return {
        "total": total,
        "running": n(WorkflowStatus.RUNNING),
        "completed": completed,
        "failed": failed,
        "pending": n(WorkflowStatus.PENDING),
        "cancelled": n(WorkflowStatus.CANCELLED),
        "success_rate": round(completed / finished, 3) if finished else 0.0,
        "failure_rate": round(failed / finished, 3) if finished else 0.0,
        "avg_completion_seconds": avg_completion,
    }
