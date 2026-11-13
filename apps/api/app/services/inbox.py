"""A user's own notifications, push preferences and push devices. Every query is scoped to the caller."""

from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, not_found
from app.core.timeutil import utcnow
from app.models import Notification, NotificationCategory, NotificationPreference, PushDevice, Role, User
from app.services import push

CATEGORIES: dict[Role, tuple[NotificationCategory, ...]] = {
    Role.customer: (NotificationCategory.visits, NotificationCategory.billing),
    Role.staff: (NotificationCategory.visits, NotificationCategory.payouts),
    Role.admin: (NotificationCategory.operations,),
}


async def list_for(
    session: AsyncSession, user: User, *, before_id: int | None, limit: int
) -> Sequence[Notification]:
    """Newest first; `before_id` pages back."""
    query = select(Notification).where(Notification.user_id == user.id)
    if before_id is not None:
        query = query.where(Notification.id < before_id)
    async with session.begin():
        return (await session.scalars(query.order_by(Notification.id.desc()).limit(limit))).all()


async def unread_count(session: AsyncSession, user: User) -> int:
    async with session.begin():
        unread = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        )
        return (await session.execute(unread)).scalar_one()


async def mark_read(session: AsyncSession, user: User, notification_id: int) -> Notification:
    async with session.begin():
        notification = await session.get(Notification, notification_id)
        if notification is None or notification.user_id != user.id:
            raise not_found("Notification")
        if notification.read_at is None:
            notification.read_at = utcnow()
    return notification


async def mark_all_read(session: AsyncSession, user: User) -> None:
    async with session.begin():
        await session.execute(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
            .values(read_at=utcnow())
        )


async def preferences(session: AsyncSession, user: User) -> list[tuple[NotificationCategory, bool]]:
    """Every category of the user's role; a category without a row is on."""
    async with session.begin():
        rows = await session.execute(
            select(NotificationPreference.category, NotificationPreference.push_enabled).where(
                NotificationPreference.user_id == user.id
            )
        )
        saved = {category: enabled for category, enabled in rows}
    return [(category, saved.get(category, True)) for category in CATEGORIES[user.role]]


async def set_preference(
    session: AsyncSession, user: User, category: NotificationCategory, push_enabled: bool
) -> None:
    if category not in CATEGORIES[user.role]:
        raise AppError(400, "invalid_category", f"{category.value} is not a category for {user.role.value}")
    async with session.begin():
        preference = await session.get(NotificationPreference, (user.id, category), with_for_update=True)
        if preference is None:
            session.add(NotificationPreference(user_id=user.id, category=category, push_enabled=push_enabled))
        else:
            preference.push_enabled = push_enabled


async def register_device(session: AsyncSession, user: User, token: str, platform: str) -> None:
    """Upserts the token for the caller (it moves from a previous owner: the phone changed hands or
    accounts). Beyond MAX_DEVICES_PER_USER the oldest devices are disabled."""
    async with session.begin():
        device = (
            await session.execute(select(PushDevice).where(PushDevice.token == token).with_for_update())
        ).scalar_one_or_none()
        now = utcnow()
        if device is None:
            session.add(PushDevice(user_id=user.id, token=token, platform=platform, last_seen_at=now))
        else:
            device.user_id = user.id
            device.platform = platform
            device.last_seen_at = now
            device.disabled_at = None
        await session.flush()
        stale = (
            await session.scalars(
                select(PushDevice.id)
                .where(PushDevice.user_id == user.id, PushDevice.disabled_at.is_(None))
                .order_by(PushDevice.last_seen_at.desc(), PushDevice.id.desc())
                .offset(push.MAX_DEVICES_PER_USER)
            )
        ).all()
        if stale:
            await session.execute(update(PushDevice).where(PushDevice.id.in_(stale)).values(disabled_at=now))


async def unregister_device(session: AsyncSession, user: User, token: str) -> None:
    """Sign-out: the caller's token stops receiving push. Someone else's token is left alone."""
    async with session.begin():
        await session.execute(
            update(PushDevice)
            .where(PushDevice.token == token, PushDevice.user_id == user.id)
            .values(disabled_at=utcnow())
        )
