"""Tests for per-job-type options validation."""

import pytest

from app.core.exceptions import InvalidPayloadError
from app.models.job import JobType
from app.schemas.payloads import validate_payload


def test_analysis_accepts_empty_options():
    assert validate_payload(JobType.CSV_ANALYSIS, {}) == {}


def test_conversion_defaults_to_json():
    assert validate_payload(JobType.FILE_CONVERSION, {}) == {"output_format": "json"}


def test_conversion_accepts_xlsx():
    out = validate_payload(JobType.FILE_CONVERSION, {"output_format": "xlsx"})
    assert out["output_format"] == "xlsx"


def test_conversion_rejects_unknown_format():
    with pytest.raises(InvalidPayloadError):
        validate_payload(JobType.FILE_CONVERSION, {"output_format": "pdf"})


def test_unknown_option_key_rejected():
    with pytest.raises(InvalidPayloadError):
        validate_payload(JobType.CSV_ANALYSIS, {"bogus": 1})


def test_validation_options_normalised():
    out = validate_payload(
        JobType.BULK_DATA_VALIDATION,
        {"required_columns": ["id"], "id_column": "id"},
    )
    assert out == {"required_columns": ["id"], "id_column": "id"}


def test_validation_options_defaults():
    out = validate_payload(JobType.BULK_DATA_VALIDATION, {})
    assert out == {"required_columns": [], "id_column": None}
