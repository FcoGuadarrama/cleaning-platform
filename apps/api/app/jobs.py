"""Background work that runs inside the API process."""

import asyncio
import logging

from app.core.db import get_sessionmaker
from app.services.scheduling import expire_holds

logger = logging.getLogger(__name__)


async def sweep_holds_forever(interval_seconds: float) -> None:
    """Releases lapsed holds every `interval_seconds`, so they are released even when nobody reads them.
    Every API process runs one; SKIP LOCKED in `expire_holds` keeps concurrent sweeps out of each other's
    way. A failed sweep is logged and the next one tries again."""
    while True:
        try:
            async with get_sessionmaker()() as session:
                released = await expire_holds(session)
            if released:
                logger.info("hold sweep released %d bookings", released)
        except Exception:
            logger.exception("hold sweep failed")
        await asyncio.sleep(interval_seconds)
