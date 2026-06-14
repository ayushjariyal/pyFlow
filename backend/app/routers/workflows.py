"""HTTP endpoints for workflows.

Thin: parse/validate input, persist uploads, and delegate all orchestration to
the scheduler engine. No DAG/scheduling logic lives here.
"""

import logging
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import storage
from app.database import get_db
from app.models.workflow import Workflow
from app.scheduler import engine
from app.schemas.workflow import (
    EdgeRead,
    WorkflowCreate,
    WorkflowMetrics,
    WorkflowRead,
    WorkflowSummary,
    WorkflowTaskRead,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _to_read(db: Session, workflow: Workflow) -> WorkflowRead:
    edges = engine.get_workflow_edges(db, workflow)
    return WorkflowRead(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status,
        input_file_path=workflow.input_file_path,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        tasks=[WorkflowTaskRead.model_validate(t) for t in workflow.tasks],
        dependencies=[EdgeRead(from_=e["from_"], to=e["to"]) for e in edges],
    )


def _get_or_404(db: Session, workflow_id: uuid.UUID) -> Workflow:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Workflow {workflow_id} not found")
    return workflow


@router.post(
    "",
    response_model=WorkflowRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workflow (DAG)",
)
def create_workflow(
    data: WorkflowCreate,
    db: Session = Depends(get_db),
) -> WorkflowRead:
    """Validate the DAG + task options and persist the workflow (status PENDING).

    Invalid DAGs (cycles, self-deps, bad refs) return 400.
    """
    workflow = engine.create_workflow(db, data)
    return _to_read(db, workflow)


@router.get("", response_model=list[WorkflowSummary], summary="List workflows")
def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[WorkflowSummary]:
    workflows = db.scalars(
        select(Workflow).order_by(Workflow.created_at.desc()).offset(skip).limit(limit)
    ).all()
    return [
        WorkflowSummary(
            id=w.id,
            name=w.name,
            status=w.status,
            created_at=w.created_at,
            updated_at=w.updated_at,
            task_count=len(w.tasks),
        )
        for w in workflows
    ]


@router.get("/metrics", response_model=WorkflowMetrics, summary="Workflow metrics")
def workflow_metrics(db: Session = Depends(get_db)) -> WorkflowMetrics:
    return WorkflowMetrics(**engine.compute_metrics(db))


@router.get("/{workflow_id}", response_model=WorkflowRead, summary="Workflow details")
def get_workflow(
    workflow_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> WorkflowRead:
    return _to_read(db, _get_or_404(db, workflow_id))


@router.post(
    "/{workflow_id}/run",
    response_model=WorkflowRead,
    summary="Trigger a workflow",
)
async def run_workflow(
    workflow_id: uuid.UUID,
    file: UploadFile | None = File(
        None, description="Input CSV for the pipeline (required on first run)"
    ),
    db: Session = Depends(get_db),
) -> WorkflowRead:
    """Start a PENDING workflow. Upload the input CSV the pipeline runs on."""
    workflow = _get_or_404(db, workflow_id)
    if workflow.status != workflow.status.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workflow is {workflow.status.value}; only PENDING workflows can run.",
        )

    input_path = workflow.input_file_path
    if file is not None:
        raw = await file.read()
        if not raw:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")
        input_path = storage.save_upload(raw, file.filename or "upload.csv")
        logger.info("workflow %s input uploaded -> %s", workflow_id, input_path)
    if not input_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An input file is required to run this workflow.",
        )

    engine.run_workflow(db, workflow, input_path)
    # Workers update task rows in separate sessions; drop cached state so the
    # response reflects the latest statuses (relevant when tasks run inline).
    db.expire_all()
    return _to_read(db, _get_or_404(db, workflow_id))


@router.post(
    "/{workflow_id}/cancel",
    response_model=WorkflowRead,
    summary="Cancel a workflow",
)
def cancel_workflow(
    workflow_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> WorkflowRead:
    workflow = _get_or_404(db, workflow_id)
    engine.cancel_workflow(db, workflow)
    db.expire_all()
    return _to_read(db, _get_or_404(db, workflow_id))
