"""Bootstrap an admin: ADMIN_PASSWORD=... uv run python -m app.create_admin admin@admin.com "Nombre"

Idempotent: an existing admin with that email is left untouched, so the dev stack can run it on every start.
"""

import asyncio
import os
import sys

from sqlalchemy import select

from app.core.db import get_engine, get_sessionmaker
from app.models import Role, User
from app.services import auth


async def main(email: str, full_name: str) -> None:
    password = os.environ["ADMIN_PASSWORD"]
    async with get_sessionmaker()() as session, session.begin():
        query = select(User).where(User.email == email.lower())
        existing = (await session.execute(query)).scalar_one_or_none()
        if existing is None:
            user = await auth.create_user(session, email, password, full_name, Role.admin)
    await get_engine().dispose()
    if existing is None:
        print(f"admin created: id={user.id}")
    elif existing.role == Role.admin:
        print(f"admin already exists: id={existing.id}")
    else:
        sys.exit(f"{email} already exists with role {existing.role.value}; refusing to treat it as admin")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Administración"))
