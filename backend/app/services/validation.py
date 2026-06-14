"""BULK_DATA_VALIDATION: validate a CSV against simple rules.

Checks required columns exist and are non-null, and reports duplicate ids.
Returns a structured validation report (also persisted to a file by the runner).
"""

from pathlib import Path

from app.services._pandas_utils import read_csv


def validate(input_path: Path, options: dict) -> dict:
    df = read_csv(input_path)
    required = options.get("required_columns") or []
    id_column = options.get("id_column")

    issues: list[dict] = []

    missing_columns = [c for c in required if c not in df.columns]
    if missing_columns:
        issues.append({"type": "missing_required_columns", "columns": missing_columns})

    nulls_in_required: dict[str, int] = {}
    for col in required:
        if col in df.columns:
            count = int(df[col].isna().sum())
            if count:
                nulls_in_required[col] = count
    if nulls_in_required:
        issues.append({"type": "nulls_in_required_columns", "details": nulls_in_required})

    duplicate_id_count = 0
    duplicate_ids: list[str] = []
    if id_column:
        if id_column not in df.columns:
            issues.append({"type": "missing_id_column", "column": id_column})
        else:
            dup_mask = df[id_column].duplicated(keep=False)
            duplicate_id_count = int(df[id_column].duplicated().sum())
            duplicate_ids = [
                str(v) for v in df.loc[dup_mask, id_column].dropna().unique()[:50]
            ]
            if duplicate_id_count:
                issues.append(
                    {"type": "duplicate_ids", "count": duplicate_id_count}
                )

    return {
        "valid": len(issues) == 0,
        "row_count": int(len(df)),
        "checked": {
            "required_columns": list(required),
            "id_column": id_column,
        },
        "issues": issues,
        "duplicate_id_count": duplicate_id_count,
        "duplicate_ids_sample": duplicate_ids,
    }
