from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(UTC)


class UTCDateTime(TypeDecorator[datetime]):
    """Stores naive UTC DATETIME(6) in MySQL and returns aware UTC datetimes."""

    impl = DateTime(timezone=False)
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if dialect.name == "mysql":
            from sqlalchemy.dialects.mysql import DATETIME

            return dialect.type_descriptor(DATETIME(fsp=6))
        return dialect.type_descriptor(DateTime())

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)
