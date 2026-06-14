"""Database engine, session factory and FastAPI session dependency.

Uses SQLAlchemy 2.0 style: a typed `DeclarativeBase` and an explicit
session-per-request dependency that is injected into the routers.
"""

from collections.abc import Generator, Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# SQLite needs `check_same_thread=False` because FastAPI serves requests from a
# threadpool and the default SQLite driver otherwise forbids cross-thread use.
# This arg is meaningless for other databases, so it's only applied for SQLite.
connect_args: dict[str, object] = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# `pool_pre_ping` transparently checks connections before use, which avoids
# "server closed the connection unexpectedly" errors after the DB restarts.
# `future=True` is implicit in SQLAlchemy 2.0 but kept explicit for clarity.
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=settings.DEBUG,  # log SQL when running in debug mode
    future=True,
)

# A session factory. `expire_on_commit=False` lets us keep using ORM objects
# (e.g. to serialise them into a response) after the transaction commits.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


class Base(DeclarativeBase):
    """Declarative base class shared by all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session.

    The session is always closed once the request finishes, even if the handler
    raises. Routers/services receive this via `Depends(get_db)`, so the database
    is never accessed through a global session.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        # Roll back an in-flight transaction before the session is returned to
        # the pool, so a failed request never leaves a partial transaction.
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a standalone session for code running OUTSIDE a request.

    Celery workers run in their own process with no FastAPI dependency
    injection, so they use this instead of `get_db`. Each call creates a fresh,
    independent session that is always closed (and rolled back on error),
    satisfying "use a separate SQLAlchemy session inside Celery workers".

    Note: commits are explicit in the caller (the task commits between status
    transitions so PENDING -> RUNNING is visible during the work), so this
    context manager intentionally does not auto-commit.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
