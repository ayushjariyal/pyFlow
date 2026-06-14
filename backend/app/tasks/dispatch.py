"""Shared executor dispatch.

Maps a JobType to the right data-processing service and runs it, returning the
result report and an optional generated output file (relative to storage). Used
by both the standalone job runner and the workflow worker so the execution
semantics are identical in either context.
"""

import json
from pathlib import Path

from app import storage
from app.models.job import JobType
from app.services import (
    csv_analysis,
    data_cleaning,
    file_conversion,
    report_generation,
    validation,
)


def dispatch(
    job_type: JobType, input_path: Path, options: dict
) -> tuple[dict, str | None]:
    """Run the workload for `job_type`.

    Returns (result_report, output_file_path_relative_or_None).
    """
    stem = input_path.stem

    if job_type == JobType.CSV_ANALYSIS:
        return csv_analysis.analyze(input_path), None

    if job_type == JobType.DATA_CLEANING:
        out_abs, out_rel = storage.new_output("processed", f"{stem}_cleaned.csv")
        return data_cleaning.clean(input_path, out_abs), out_rel

    if job_type == JobType.FILE_CONVERSION:
        fmt = options.get("output_format", "json")
        ext = "json" if fmt == "json" else "xlsx"
        out_abs, out_rel = storage.new_output("processed", f"{stem}.{ext}")
        return file_conversion.convert(input_path, out_abs, fmt), out_rel

    if job_type == JobType.DATA_PROFILE_REPORT:
        out_abs, out_rel = storage.new_output("reports", f"{stem}_profile.html")
        return report_generation.generate_html(input_path, out_abs), out_rel

    if job_type == JobType.BULK_DATA_VALIDATION:
        report = validation.validate(input_path, options)
        out_abs, out_rel = storage.new_output("reports", f"{stem}_validation.json")
        out_abs.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report, out_rel

    raise ValueError(f"Unsupported job_type: {job_type}")
