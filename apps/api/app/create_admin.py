"""Bootstrap an admin: ADMIN_PASSWORD=... uv run python -m app.create_admin admin@admin.com "Nombre" """

import asyncio
import os
import sys

from app.core.db import get_engine, get_sessionmaker
from app.models import Role
from app.services import auth


async def main(email: str, full_name: str) -> None:
    password = os.environ["ADMIN_PASSWORD"]
    async with get_sessionmaker()() as session, session.begin():
        user = await auth.create_user(session, email, password, full_name, Role.admin)
    await get_engine().dispose()
    print(f"admin created: id={user.id}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Administración"))
