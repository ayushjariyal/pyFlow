"""HTTP endpoints for data-processing jobs.

The router stays thin: it handles HTTP concerns (multipart, form parsing, file
responses, status codes) and delegates all logic to JobService. File storage is
done here only to the extent of persisting the upload bytes via the storage
helper before handing the path to the service.
"""

import json
import logging
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import storage
from app.database import get_db
from app.models.job import JobStatus, JobType
from app.schemas.job import JobCreate, JobRead, JobStatusResponse
from app.services.job_service import JobService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def get_job_service(db: Session = Depends(get_db)) -> JobService:
    """Provide a JobService bound to the request-scoped DB session."""
    return JobService(db)


def _parse_options(raw: str) -> dict:
    """Parse the `options` form field (a JSON string) into a dict."""
    raw = (raw or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"`options` is not valid JSON: {exc}",
        )
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="`options` must be a JSON object.",
        )
    return parsed


@router.post(
    "/upload",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a file and create a processing job",
)
async def upload_and_create_job(
    job_type: JobType = Form(..., description="Processing job type"),
    file: UploadFile = File(..., description="CSV file to process"),
    options: str = Form("{}", description="Per-type options as a JSON string"),
    service: JobService = Depends(get_job_service),
) -> JobRead:
    """Store the uploaded file, then create + enqueue a job that processes it."""
    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    parsed_options = _parse_options(options)
    input_path = storage.save_upload(raw, file.filename or "upload.csv")
    logger.info("file uploaded -> %s (%s bytes)", input_path, len(raw))

    return service.create_processing_job(
        job_type=job_type,
        input_file_path=input_path,
        options=parsed_options,
        original_filename=file.filename,
    )


@router.post(
    "",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job for an already-uploaded file",
)
def create_job(
    payload: JobCreate,
    service: JobService = Depends(get_job_service),
) -> JobRead:
    """Create a job referencing a previously uploaded file (400 if it's gone)."""
    try:
        resolved = storage.resolve(payload.input_file_path)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid input_file_path.",
        )
    if not resolved.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Input file not found: {payload.input_file_path}",
        )
    return service.create_processing_job(
        job_type=payload.job_type,
        input_file_path=payload.input_file_path,
        options=payload.payload,
        original_filename=resolved.name,
    )


@router.get("", response_model=list[JobRead], summary="List jobs")
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: JobService = Depends(get_job_service),
) -> list[JobRead]:
    return service.list_jobs(skip=skip, limit=limit)


@router.get("/{job_id}", response_model=JobRead, summary="Get a job by id")
def get_job(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
) -> JobRead:
    job = service.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    return job


@router.get(
    "/{job_id}/status",
    response_model=JobStatusResponse,
    summary="Get a job's status",
)
def get_job_status(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
) -> JobStatusResponse:
    job = service.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    return JobStatusResponse(
        job_id=job.id,
        job_type=job.job_type,
        status=job.status,
        execution_time=job.execution_time,
        celery_task_id=job.celery_task_id,
    )


@router.get("/{job_id}/download", summary="Download a job's output file")
def download_output(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
) -> FileResponse:
    """Stream the generated output file (cleaned CSV / converted file / report)."""
    job = service.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    if not job.output_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This job has no downloadable output.",
        )
    path = storage.resolve(job.output_file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Output file is missing from storage.",
        )
    return FileResponse(path, filename=path.name)


@router.post(
    "/{job_id}/retry",
    response_model=JobRead,
    summary="Retry a failed job",
)
def retry_job(
    job_id: uuid.UUID,
    service: JobService = Depends(get_job_service),
) -> JobRead:
    job = service.get_job(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} not found")
    if job.status != JobStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Only FAILED jobs can be retried; job {job_id} is "
                f"{job.status.value}."
            ),
        )
    return service.retry_job(job)
