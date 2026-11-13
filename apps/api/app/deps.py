from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError, forbidden
from app.core.security import hash_token
from app.core.timeutil import utcnow
from app.models import AuthToken, Role, User

SessionDep = Annotated[AsyncSession, Depends(get_session)]
IdempotencyKeyHeader = Annotated[
    str | None,
    Header(
        min_length=1,
        max_length=64,
        description="Client-generated key (a UUID) for this create. A retry with the same key and body "
        "returns the resource the first attempt created; the same key with a different body is 409 "
        "idempotency_key_reused.",
    ),
]
_bearer = HTTPBearer(auto_error=False)


async def current_user(
    session: SessionDep, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    if creds is None:
        raise AppError(401, "unauthenticated", "Authentication required")
    row = await session.execute(
        select(User)
        .join(AuthToken, AuthToken.user_id == User.id)
        .where(AuthToken.token_hash == hash_token(creds.credentials), AuthToken.expires_at > utcnow())
    )
    user = row.scalar_one_or_none()
    await session.commit()  # end the read transaction so services can open their own boundaries
    if user is None or not user.is_active:
        raise AppError(401, "unauthenticated", "Invalid or expired token")
    # A detached snapshot: a service transaction that rolls back (and is retried) never expires it.
    session.expunge(user)
    return user


def require(*roles: Role) -> Callable[..., Coroutine[Any, Any, User]]:
    async def dep(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return dep


UserDep = Annotated[User, Depends(current_user)]
AdminDep = Annotated[User, Depends(require(Role.admin))]
StaffDep = Annotated[User, Depends(require(Role.staff))]
CustomerDep = Annotated[User, Depends(require(Role.customer))]
