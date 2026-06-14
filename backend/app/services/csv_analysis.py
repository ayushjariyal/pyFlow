"""CSV_ANALYSIS: profile a CSV's shape, types, missing values and numeric stats.

Pure function over a file path (no DB / Celery) so it is unit-testable.
"""

from pathlib import Path

import pandas as pd

from app.services._pandas_utils import jsonable, read_csv


def analyze(input_path: Path) -> dict:
    df = read_csv(input_path)
    numeric = df.select_dtypes(include="number")

    numeric_stats = {}
    for col in numeric.columns:
        series = numeric[col]
        numeric_stats[col] = jsonable(
            {
                "min": series.min(),
                "max": series.max(),
                "mean": series.mean(),
                "std": series.std(),
                "median": series.median(),
            }
        )

    return {
        "row_count": int(len(df)),
        "column_count": int(df.shape[1]),
        "columns": list(map(str, df.columns)),
        "dtypes": {str(c): str(t) for c, t in df.dtypes.items()},
        "missing_values": {
            str(c): int(df[c].isna().sum()) for c in df.columns
        },
        "missing_total": int(df.isna().sum().sum()),
        "numeric_statistics": numeric_stats,
    }
