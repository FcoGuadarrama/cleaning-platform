import asyncio
import functools
import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from functools import lru_cache

from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.errors import AppError

# MySQL error codes.
DUPLICATE_KEY = 1062
LOCK_WAIT_TIMEOUT = 1205
DEADLOCK = 1213
LOCK_RETRY_ATTEMPTS = 3


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(get_settings().database_url, pool_pre_ping=True, pool_recycle=1800)


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per request; services own the transaction boundaries."""
    async with get_sessionmaker()() as session:
        yield session


def mysql_code(exc: DBAPIError) -> int | None:
    args = getattr(exc.orig, "args", ())
    return args[0] if args and isinstance(args[0], int) else None


async def insert_unless_duplicate(session: AsyncSession, row: object) -> bool:
    """Inserts `row` under a savepoint. False when a unique key already holds it; the caller's transaction
    stays usable. Any other integrity failure propagates."""
    try:
        async with session.begin_nested():
            session.add(row)
    except IntegrityError as exc:
        if mysql_code(exc) != DUPLICATE_KEY:
            raise
        return False
    return True


def retry_on_lock_conflict[**P, R](fn: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """Re-runs a service call whose writes form one transaction when InnoDB aborts it for a deadlock or a
    lock-wait timeout: the aborted attempt rolled back completely, so running it again is safe. Gives up with
    503."""

    @functools.wraps(fn)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        attempt = 1
        while True:
            try:
                return await fn(*args, **kwargs)
            except OperationalError as exc:
                if mysql_code(exc) not in (DEADLOCK, LOCK_WAIT_TIMEOUT):
                    raise
                if attempt == LOCK_RETRY_ATTEMPTS:
                    raise AppError(503, "database_busy", "The service is busy, try again") from exc
            # Jitter so the transactions that collided do not collide again in lockstep.
            await asyncio.sleep((20 + secrets.randbelow(80)) * attempt / 1000)
            attempt += 1

    return wrapper
