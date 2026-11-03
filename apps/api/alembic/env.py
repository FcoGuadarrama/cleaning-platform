import asyncio
import os

from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context
from app.core.timeutil import UTCDateTime
from app.models import Base

target_metadata = Base.metadata


def _render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    if type_ == "type" and isinstance(obj, UTCDateTime):
        autogen_context.imports.add("from sqlalchemy.dialects import mysql")  # type: ignore[attr-defined]
        return "mysql.DATETIME(fsp=6)"
    return False


def _run(connection: Connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True, render_item=_render_item
    )
    with context.begin_transaction():
        context.run_migrations()


async def _main() -> None:
    url = context.config.attributes.get("database_url") or os.environ["DATABASE_URL"]
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    raise SystemExit("offline mode is not supported; run against the worktree MySQL")
asyncio.run(_main())
