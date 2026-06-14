"""Shared helpers for the data-processing services."""

import math
from pathlib import Path
from typing import Any

import pandas as pd


class InvalidCsvError(Exception):
    """Raised when an input file can't be parsed as CSV."""


def read_csv(path: Path) -> pd.DataFrame:
    """Read a CSV into a DataFrame, raising InvalidCsvError on any problem."""
    try:
        df = pd.read_csv(path)
    except FileNotFoundError:
        raise
    except Exception as exc:  # noqa: BLE001 - normalise all parse errors
        raise InvalidCsvError(f"Could not parse CSV: {exc}") from exc
    if df.shape[1] == 0:
        raise InvalidCsvError("CSV has no columns.")
    return df


def jsonable(value: Any) -> Any:
    """Convert pandas/numpy values into JSON-serialisable Python primitives.

    Critically, NaN/inf become None — `json.dumps` would otherwise emit the
    invalid tokens `NaN`/`Infinity`, which break JSON parsing on read-back.
    """
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    # pandas/numpy scalars expose .item(); fall back to the value itself.
    if hasattr(value, "item"):
        try:
            value = value.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(value, float):
        return None if (math.isnan(value) or math.isinf(value)) else value
    if value is pd.NA or value is None:
        return None
    if isinstance(value, (int, str, bool)):
        return value
    return str(value)
