from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, conflict
from app.core.security import hash_password, hash_token, new_token, verify_password
from app.core.timeutil import utcnow
from app.models import AuthToken, Role, User


async def create_user(session: AsyncSession, email: str, password: str, full_name: str, role: Role) -> User:
    user = User(email=email.lower(), password_hash=hash_password(password), full_name=full_name, role=role)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise conflict("email_taken", "Email already registered") from exc
    return user


async def issue_token(session: AsyncSession, user: User) -> tuple[str, AuthToken]:
    token = new_token()
    row = AuthToken(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=utcnow() + timedelta(hours=get_settings().token_ttl_hours),
    )
    session.add(row)
    await session.flush()
    return token, row


async def login(session: AsyncSession, email: str, password: str) -> tuple[str, AuthToken, User]:
    user = (await session.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise AppError(401, "invalid_credentials", "Invalid email or password")
    token, row = await issue_token(session, user)
    return token, row, user
