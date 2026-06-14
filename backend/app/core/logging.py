"""Central logging configuration.

Called once at startup by both the FastAPI app and the Celery worker so log
output has a consistent, timestamped format across processes.
"""

import logging

_CONFIGURED = False


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once (idempotent)."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _CONFIGURED = True
