from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.core.errors import ERROR_RESPONSES
from app.deps import SessionDep, UserDep, require
from app.models import NotificationCategory, Role, User
from app.schemas import (
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceRequest,
    PushDeviceRequest,
    UnreadCountOut,
)
from app.services import inbox

router = APIRouter(tags=["notifications"], responses=ERROR_RESPONSES)
# Admins read their inbox in the dashboard; push is for the mobile app only.
MobileUserDep = Annotated[User, Depends(require(Role.customer, Role.staff))]


@router.get("/notifications", name="notifications_list")
async def list_notifications(
    session: SessionDep,
    user: UserDep,
    before_id: Annotated[int | None, Query(description="Page back: notifications older than this id")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
) -> list[NotificationOut]:
    """The caller's inbox, newest first."""
    rows = await inbox.list_for(session, user, before_id=before_id, limit=limit)
    return [NotificationOut.model_validate(n) for n in rows]


@router.get("/notifications/unread-count", name="notifications_unread_count")
async def unread_count(session: SessionDep, user: UserDep) -> UnreadCountOut:
    return UnreadCountOut(count=await inbox.unread_count(session, user))


@router.post("/notifications/{notification_id}/read", name="notifications_mark_read")
async def mark_read(notification_id: int, session: SessionDep, user: UserDep) -> NotificationOut:
    return NotificationOut.model_validate(await inbox.mark_read(session, user, notification_id))


@router.post("/notifications/read-all", status_code=204, name="notifications_mark_all_read")
async def mark_all_read(session: SessionDep, user: UserDep) -> Response:
    await inbox.mark_all_read(session, user)
    return Response(status_code=204)


@router.delete("/notifications/{notification_id}", status_code=204, name="notifications_delete")
async def delete_notification(notification_id: int, session: SessionDep, user: UserDep) -> Response:
    """Removes the notification from the caller's inbox. 404 if it is not theirs."""
    await inbox.remove(session, user, notification_id)
    return Response(status_code=204)


@router.get("/notification-preferences", name="notification_preferences_list")
async def list_preferences(session: SessionDep, user: UserDep) -> list[NotificationPreferenceOut]:
    """Push on/off for each category of the caller's role. The inbox always keeps every notification."""
    return [
        NotificationPreferenceOut(category=category, push_enabled=enabled)
        for category, enabled in await inbox.preferences(session, user)
    ]


@router.put("/notification-preferences/{category}", name="notification_preferences_set")
async def set_preference(
    category: NotificationCategory, body: NotificationPreferenceRequest, session: SessionDep, user: UserDep
) -> NotificationPreferenceOut:
    await inbox.set_preference(session, user, category, body.push_enabled)
    return NotificationPreferenceOut(category=category, push_enabled=body.push_enabled)


@router.put("/push-devices", status_code=204, name="push_devices_register")
async def register_device(body: PushDeviceRequest, session: SessionDep, user: MobileUserDep) -> Response:
    """Registers the app's Expo push token for the caller."""
    await inbox.register_device(session, user, body.token, body.platform)
    return Response(status_code=204)


@router.delete("/push-devices/{token}", status_code=204, name="push_devices_unregister")
async def unregister_device(token: str, session: SessionDep, user: UserDep) -> Response:
    """Call before signing out, so the phone stops receiving this user's push."""
    await inbox.unregister_device(session, user, token)
    return Response(status_code=204)
