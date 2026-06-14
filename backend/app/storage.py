"""File storage helpers for uploads and generated outputs.

Layout (under STORAGE_DIR):

    storage/
    ├── uploads/     # raw uploaded files
    ├── processed/   # cleaned / converted data files
    └── reports/     # HTML / JSON reports

Paths are stored in the DB *relative* to the storage base (e.g.
"uploads/<uuid>_data.csv") so they stay portable; `resolve()` turns them back
into absolute paths and guards against path traversal.
"""

import os
import re
import uuid
from pathlib import Path

from app.core.config import settings

BASE = Path(settings.STORAGE_DIR).resolve()
UPLOADS = BASE / "uploads"
PROCESSED = BASE / "processed"
REPORTS = BASE / "reports"

# Map the logical subdirectory name used by callers to its path.
_SUBDIRS = {"uploads": UPLOADS, "processed": PROCESSED, "reports": REPORTS}


def ensure_dirs() -> None:
    """Create the storage directory tree if it doesn't exist (idempotent)."""
    for d in (UPLOADS, PROCESSED, REPORTS):
        d.mkdir(parents=True, exist_ok=True)


def _safe_name(name: str) -> str:
    """Strip directories and unsafe characters from a user-supplied filename."""
    base = os.path.basename(name or "")
    cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return cleaned or "file"


def save_upload(content: bytes, original_filename: str) -> str:
    """Persist uploaded bytes under uploads/ with a collision-proof name.

    Returns the path relative to the storage base.
    """
    ensure_dirs()
    name = f"{uuid.uuid4().hex}_{_safe_name(original_filename)}"
    (UPLOADS / name).write_bytes(content)
    return f"uploads/{name}"


def new_output(subdir: str, desired_name: str) -> tuple[Path, str]:
    """Reserve a unique output path in `subdir`.

    Returns (absolute_path, relative_path). The file itself is created by the
    caller (a service writing its result).
    """
    ensure_dirs()
    if subdir not in _SUBDIRS:
        raise ValueError(f"Unknown storage subdir: {subdir}")
    name = f"{uuid.uuid4().hex[:8]}_{_safe_name(desired_name)}"
    return _SUBDIRS[subdir] / name, f"{subdir}/{name}"


def resolve(relative_path: str) -> Path:
    """Resolve a stored relative path to an absolute one, rejecting traversal."""
    target = (BASE / relative_path).resolve()
    if not str(target).startswith(str(BASE)):
        raise ValueError(f"Illegal path outside storage: {relative_path}")
    return target


# Create the tree on import so the dirs exist for both web and worker processes.
ensure_dirs()
