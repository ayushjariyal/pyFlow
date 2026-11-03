"""Fan-in race: when two parents of the same child finish at the same moment on
different workers, the child must be dispatched exactly once."""

import threading
import uuid
from unittest.mock import patch

from sqlalchemy import select

from app.database import SessionLocal
from app.models.workflow import TaskStatus, Workflow, WorkflowStatus, WorkflowTask
from app.scheduler import engine


def _diamond(client) -> uuid.UUID:
    """Create (but don't run) a workflow where `a` and `b` both feed `c`."""
    resp = client.post(
        "/workflows",
        json={
            "name": "fan-in",
            "tasks": [
                {"id": "a", "type": "CSV_ANALYSIS"},
                {"id": "b", "type": "CSV_ANALYSIS"},
                {"id": "c", "type": "CSV_ANALYSIS"},
            ],
            "dependencies": [{"from_": "a", "to": "c"}, {"from_": "b", "to": "c"}],
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return uuid.UUID(resp.json()["id"])


def _tasks_by_ref(db, workflow_id) -> dict[str, WorkflowTask]:
    rows = db.scalars(
        select(WorkflowTask).where(WorkflowTask.workflow_id == workflow_id)
    ).all()
    return {t.ref: t for t in rows}


def test_claim_succeeds_only_once_across_sessions(client):
    wid = _diamond(client)
    with SessionLocal() as s1, SessionLocal() as s2:
        child_id = _tasks_by_ref(s1, wid)["c"].id
        # Both "workers" have already read the child as PENDING.
        assert _tasks_by_ref(s2, wid)["c"].status == TaskStatus.PENDING

        assert engine._claim_task(s1, child_id) is True
        assert engine._claim_task(s2, child_id) is False


def test_claim_succeeds_only_once_under_threads(client):
    wid = _diamond(client)
    with SessionLocal() as db:
        child_id = _tasks_by_ref(db, wid)["c"].id

    n = 8
    barrier = threading.Barrier(n)
    wins: list[bool] = []
    lock = threading.Lock()

    def worker():
        with SessionLocal() as db:
            barrier.wait()  # release all threads at the same moment
            won = engine._claim_task(db, child_id)
        with lock:
            wins.append(won)

    threads = [threading.Thread(target=worker) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(wins) == n
    assert wins.count(True) == 1


def test_both_parents_succeeding_dispatches_child_once(client):
    """Simulates both workers seeing every parent as SUCCESS before either has
    dispatched the child. Before the fix, the child was dispatched twice."""
    wid = _diamond(client)
    with SessionLocal() as db:
        wf = db.get(Workflow, wid)
        wf.status = WorkflowStatus.RUNNING
        wf.input_file_path = "uploads/input.csv"
        tasks = _tasks_by_ref(db, wid)
        for ref in ("a", "b"):
            tasks[ref].status = TaskStatus.SUCCESS
        db.commit()
        a_id, b_id, c_id = tasks["a"].id, tasks["b"].id, tasks["c"].id

    # Record dispatches without running anything.
    with patch.object(engine, "_dispatch_task") as dispatch:
        with SessionLocal() as db:
            engine.handle_task_success(db, a_id, {}, None, 0.1)
        with SessionLocal() as db:
            engine.handle_task_success(db, b_id, {}, None, 0.1)

    dispatched = [call.args[1].id for call in dispatch.call_args_list]
    assert dispatched == [c_id]
