"""Health-check endpoint.

Kept separate from business routers because liveness probes (Docker, k8s, load
balancers) target it and it should stay dependency-free and fast.
"""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness check")
def health() -> dict[str, str]:
    """Return a static healthy response.

    Intentionally does not touch the database so the process can report liveness
    even while the DB is briefly unavailable.
    """
    return {"status": "healthy"}
