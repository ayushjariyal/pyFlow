"""FastAPI application entrypoint.

Wires together configuration, routers and global error handling. The app object
is created via a small factory so it can be imported cleanly by Uvicorn
(`app.main:app`) and by tests.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.exceptions import InvalidPayloadError
from app.core.logging import configure_logging
from app.routers import health, jobs, workflows
from app.scheduler.dag import DagValidationError

configure_logging()
logger = logging.getLogger("job_platform")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )

    # --- CORS ---
    # Allow the browser-based frontend (Vite dev server) to call the API.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Routers ---
    app.include_router(health.router)
    app.include_router(jobs.router)
    app.include_router(workflows.router)

    # --- Global error handling ---
    # An invalid job payload is a client error: return 400 with the structured
    # validation details so callers can see exactly what was wrong.
    @app.exception_handler(InvalidPayloadError)
    async def invalid_payload_handler(
        request: Request, exc: InvalidPayloadError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": exc.message, "errors": exc.errors},
        )

    # An invalid workflow DAG (cycle, self-dependency, bad task ref) is a 400.
    @app.exception_handler(DagValidationError)
    async def dag_validation_handler(
        request: Request, exc: DagValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": str(exc)},
        )

    # Any database error that bubbles up is turned into a clean 503 instead of a
    # raw stack trace, so clients get a predictable JSON shape and internals are
    # not leaked.
    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        logger.exception("Database error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "A database error occurred. Please try again later."},
        )

    return app


# Module-level instance used by Uvicorn (`uvicorn app.main:app`).
app = create_app()
