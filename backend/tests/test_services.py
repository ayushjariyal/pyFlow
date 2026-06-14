"""Unit tests for the data-processing service modules (pure, file-based)."""

import json

import pandas as pd
import pytest

from app.services import (
    csv_analysis,
    data_cleaning,
    file_conversion,
    report_generation,
    validation,
)
from app.services._pandas_utils import InvalidCsvError

SAMPLE_CSV = (
    "id,name,age,city\n"
    "1, Alice ,30,NYC\n"
    "2,Bob,,LA\n"
    "2,Bob,,LA\n"  # duplicate row
    "3,Carol,41,SF\n"
)


@pytest.fixture()
def csv_file(tmp_path):
    p = tmp_path / "data.csv"
    p.write_text(SAMPLE_CSV, encoding="utf-8")
    return p


def test_csv_analysis(csv_file):
    report = csv_analysis.analyze(csv_file)
    assert report["row_count"] == 4
    assert report["column_count"] == 4
    assert report["columns"] == ["id", "name", "age", "city"]
    # `age` has two missing values (the two duplicate Bob rows).
    assert report["missing_values"]["age"] == 2
    assert "age" in report["numeric_statistics"]
    assert report["numeric_statistics"]["age"]["max"] == 41


def test_data_cleaning_removes_duplicates_and_trims(csv_file, tmp_path):
    out = tmp_path / "cleaned.csv"
    report = data_cleaning.clean(csv_file, out)
    assert report["rows_before"] == 4
    assert report["rows_after"] == 3  # one duplicate dropped
    assert report["duplicates_removed"] == 1
    cleaned = pd.read_csv(out)
    assert len(cleaned) == 3
    # Whitespace around " Alice " was trimmed.
    assert "Alice" in set(cleaned["name"])


def test_file_conversion_json(csv_file, tmp_path):
    out = tmp_path / "out.json"
    report = file_conversion.convert(csv_file, out, "json")
    assert report["output_format"] == "json"
    records = json.loads(out.read_text(encoding="utf-8"))
    assert isinstance(records, list) and len(records) == 4


def test_file_conversion_xlsx(csv_file, tmp_path):
    out = tmp_path / "out.xlsx"
    file_conversion.convert(csv_file, out, "xlsx")
    assert out.exists() and out.stat().st_size > 0
    # Round-trip to confirm it's a valid workbook.
    assert len(pd.read_excel(out)) == 4


def test_report_generation_html(csv_file, tmp_path):
    out = tmp_path / "report.html"
    report = report_generation.generate_html(csv_file, out)
    assert out.exists()
    html = out.read_text(encoding="utf-8")
    assert "<html" in html.lower() and "Data Profile Report" in html
    assert report["row_count"] == 4
    assert "age" in report["null_percentages"]


def test_validation_detects_duplicate_ids(csv_file):
    report = validation.validate(
        csv_file, {"required_columns": ["id", "name"], "id_column": "id"}
    )
    assert report["valid"] is False
    assert report["duplicate_id_count"] == 1
    assert "2" in report["duplicate_ids_sample"]


def test_validation_passes_clean_data(tmp_path):
    p = tmp_path / "clean.csv"
    p.write_text("id,name\n1,A\n2,B\n3,C\n", encoding="utf-8")
    report = validation.validate(
        p, {"required_columns": ["id", "name"], "id_column": "id"}
    )
    assert report["valid"] is True
    assert report["issues"] == []


def test_invalid_csv_raises(tmp_path):
    p = tmp_path / "empty.csv"
    p.write_text("", encoding="utf-8")
    with pytest.raises(InvalidCsvError):
        csv_analysis.analyze(p)
