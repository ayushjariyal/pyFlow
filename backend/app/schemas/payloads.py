"""Per-job-type options (payload) schemas and validation.

In the data-processing platform the job *input* is an uploaded file; `payload`
carries per-type **options** (mostly optional). Centralising the schemas here
lets both the API (validate-on-create) and the worker agree on valid options.
`validate_payload` is the single entry point used by the service layer.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from app.core.exceptions import InvalidPayloadError
from app.models.job import JobType


class _StrictModel(BaseModel):
    # Reject unknown keys so a typo'd option is a 400, not silently ignored.
    model_config = ConfigDict(extra="forbid")


class CsvAnalysisOptions(_StrictModel):
    """No options — analyses the whole file."""


class DataCleaningOptions(_StrictModel):
    """No options for now (dedup + trim + missing-value detection)."""


class FileConversionOptions(_StrictModel):
    output_format: Literal["json", "xlsx"] = "json"


class DataProfileOptions(_StrictModel):
    """No options — profiles every column."""


class BulkValidationOptions(_StrictModel):
    # Columns that must be present and non-null.
    required_columns: list[str] = []
    # Column whose values must be unique (e.g. an id); duplicates are reported.
    id_column: str | None = None


PAYLOAD_MODELS: dict[JobType, type[_StrictModel]] = {
    JobType.CSV_ANALYSIS: CsvAnalysisOptions,
    JobType.DATA_CLEANING: DataCleaningOptions,
    JobType.FILE_CONVERSION: FileConversionOptions,
    JobType.DATA_PROFILE_REPORT: DataProfileOptions,
    JobType.BULK_DATA_VALIDATION: BulkValidationOptions,
}


def validate_payload(job_type: JobType, payload: dict[str, Any]) -> dict[str, Any]:
    """Validate `payload` against `job_type`'s options schema; return normalised.

    Raises InvalidPayloadError (-> HTTP 400) on any mismatch.
    """
    model = PAYLOAD_MODELS.get(job_type)
    if model is None:  # defensive: every JobType should be mapped
        raise InvalidPayloadError(f"Unsupported job_type: {job_type}")

    if not isinstance(payload, dict):
        raise InvalidPayloadError("options must be a JSON object")

    try:
        return model(**payload).model_dump()
    except ValidationError as exc:
        raise InvalidPayloadError(
            f"Invalid options for job_type {job_type.value}",
            errors=exc.errors(include_url=False),
        ) from exc
