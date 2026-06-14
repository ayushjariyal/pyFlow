"""Domain-level exceptions, kept free of any HTTP/framework imports.

Routers (or a global handler) translate these into HTTP responses, so the
service layer can signal problems without depending on FastAPI.
"""

from typing import Any


class InvalidPayloadError(Exception):
    """Raised when a job's payload doesn't match its job_type's schema.

    Surfaced to clients as HTTP 400. `errors` carries the structured Pydantic
    validation details when available.
    """

    def __init__(self, message: str, errors: Any | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.errors = errors
