"""FILE_CONVERSION: convert a CSV to JSON or XLSX.

Writes the converted file to `output_path` and returns a small summary.
"""

from pathlib import Path

from app.services._pandas_utils import read_csv


def convert(input_path: Path, output_path: Path, output_format: str) -> dict:
    df = read_csv(input_path)

    if output_format == "json":
        # records orient => a list of row objects; NaN serialises to null.
        df.to_json(output_path, orient="records", indent=2)
    elif output_format == "xlsx":
        df.to_excel(output_path, index=False)  # requires openpyxl
    else:
        raise ValueError(f"Unsupported output_format: {output_format}")

    return {
        "output_format": output_format,
        "row_count": int(len(df)),
        "column_count": int(df.shape[1]),
        "columns": list(map(str, df.columns)),
    }
