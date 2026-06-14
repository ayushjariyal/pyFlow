"""Shared pytest fixtures.

IMPORTANT: environment variables are set *before* any `app.*` import so the
settings singleton picks up the isolated test database and Celery runs tasks
inline (eager) instead of needing a real Redis/worker.
"""

import os

# Isolated, disposable SQLite DB so tests never touch the dev `jobs.db`.
os.environ["DATABASE_URL"] = "sqlite:///./test_jobs.db"
# Isolated storage so tests never write into the real storage/ tree.
os.environ["STORAGE_DIR"] = "./_test_storage"
# Eager mode is configured below; these just avoid any real broker connection.
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
os.environ.setdefault("CELERY_RESULT_BACKEND", "cache+memory://")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.celery_app import celery_app  # noqa: E402

# Run tasks synchronously in-process. `eager_propagates=False` mirrors real async
# behaviour: a task error marks the job FAILED rather than raising into .delay().
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = False

import app.models  # noqa: E402,F401  (register models on Base.metadata)
from app.database import Base, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    """Create the schema once for the test session, then clean up."""
    import shutil

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        os.remove("./test_jobs.db")
    except OSError:
        pass
    shutil.rmtree("./_test_storage", ignore_errors=True)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(fastapi_app)
