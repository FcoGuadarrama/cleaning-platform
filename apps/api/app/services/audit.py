from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def record(
    session: AsyncSession, actor_id: int | None, action: str, entity: str, entity_id: int, **data: Any
) -> None:
    session.add(AuditLog(actor_id=actor_id, action=action, entity=entity, entity_id=entity_id, data=data))
