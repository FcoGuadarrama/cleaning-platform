"""Background work that runs inside every API process. Each job is safe to run in several processes at once
(SKIP LOCKED claims, idempotent deletes), so no leader election is needed."""

import asyncio
import logging
from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.db import get_sessionmaker
from app.services import housekeeping, outbox
from app.services.scheduling import expire_holds

logger = logging.getLogger(__name__)

Job = Callable[[AsyncSession], Awaitable[int]]


def start(settings: Settings) -> list[asyncio.Task[None]]:
    """An interval of 0 turns a job off."""
    jobs: list[tuple[str, float, Job]] = [
        ("hold sweep", settings.hold_sweep_interval_seconds, expire_holds),
        ("outbox dispatch", settings.outbox_dispatch_interval_seconds, outbox.dispatch),
        ("housekeeping", settings.housekeeping_interval_seconds, housekeeping.prune),
    ]
    return [asyncio.create_task(_every(name, interval, job)) for name, interval, job in jobs if interval > 0]


async def stop(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


async def _every(name: str, interval_seconds: float, job: Job) -> None:
    """A failed run is logged and the next one tries again."""
    while True:
        try:
            async with get_sessionmaker()() as session:
                done = await job(session)
            if done:
                logger.info("%s: %d rows", name, done)
        except Exception:
            logger.exception("%s failed", name)
        await asyncio.sleep(interval_seconds)
