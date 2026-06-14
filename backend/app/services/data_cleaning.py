"""DATA_CLEANING: remove duplicate rows, trim whitespace, report missing values.

Writes a cleaned CSV to `output_path` and returns a summary report.
"""

from pathlib import Path

from app.services._pandas_utils import read_csv


def clean(input_path: Path, output_path: Path) -> dict:
    df = read_csv(input_path)
    rows_before = int(len(df))

    # Trim whitespace on text columns (NaN is preserved by the .str accessor).
    # pandas 3 reads text as the new `str` dtype; include both for compatibility.
    for col in df.select_dtypes(include=["object", "str"]).columns:
        df[col] = df[col].str.strip()

    cleaned = df.drop_duplicates()
    rows_after = int(len(cleaned))

    cleaned.to_csv(output_path, index=False)

    return {
        "rows_before": rows_before,
        "rows_after": rows_after,
        "duplicates_removed": rows_before - rows_after,
        "columns": list(map(str, cleaned.columns)),
        "missing_values": {
            str(c): int(cleaned[c].isna().sum()) for c in cleaned.columns
        },
    }
