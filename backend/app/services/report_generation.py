"""DATA_PROFILE_REPORT: generate a self-contained HTML profile report.

Includes a column summary (dtype, non-null, null %), numeric distributions
(describe) and top categorical value counts. Writes HTML to `output_path` and
returns a compact JSON summary for the job result.
"""

from pathlib import Path

import pandas as pd

from app.services._pandas_utils import jsonable, read_csv

_STYLE = """
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; }
  h1 { margin-bottom: 0.25rem; }
  h2 { margin-top: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: .25rem; }
  table { border-collapse: collapse; margin: .5rem 0 1.5rem; font-size: 14px; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
  th { background: #f8fafc; }
  .muted { color: #64748b; }
</style>
"""


def generate_html(input_path: Path, output_path: Path) -> dict:
    df = read_csv(input_path)
    n = int(len(df))

    null_pct = (df.isna().mean() * 100).round(2)
    summary = pd.DataFrame(
        {
            "dtype": df.dtypes.astype(str),
            "non_null": df.notna().sum(),
            "null_%": null_pct,
        }
    )

    numeric = df.select_dtypes(include="number")
    # pandas 3 reads text as the new `str` dtype; include both for compatibility.
    categorical = df.select_dtypes(include=["object", "str"])

    parts = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        "<title>Data Profile Report</title>",
        _STYLE,
        "</head><body>",
        "<h1>Data Profile Report</h1>",
        f"<p class='muted'>{n} rows · {df.shape[1]} columns · "
        f"source: {input_path.name}</p>",
        "<h2>Column summary</h2>",
        summary.to_html(),
    ]

    if not numeric.empty:
        parts += ["<h2>Numeric distributions</h2>", numeric.describe().to_html()]

    if not categorical.empty:
        parts.append("<h2>Top categorical values</h2>")
        for col in categorical.columns:
            counts = categorical[col].value_counts().head(10).to_frame("count")
            parts += [f"<h3>{col}</h3>", counts.to_html()]

    parts.append("</body></html>")
    output_path.write_text("\n".join(parts), encoding="utf-8")

    return {
        "row_count": n,
        "column_count": int(df.shape[1]),
        "columns": list(map(str, df.columns)),
        "null_percentages": jsonable(null_pct.to_dict()),
    }
