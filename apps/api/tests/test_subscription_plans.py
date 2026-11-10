from typing import Any

from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import get_sessionmaker
from app.models import AuditLog

# Test fixture values only — not business prices.
PLAN = {
    "name": "Semanal",
    "description": "Un día a la semana con la misma persona",
    "days_per_week": 1,
    "visit_duration_minutes": 180,
    "price_minor": 160000,
    "staff_earning_minor": 15000,
    "terms": "Condiciones de prueba.",
}


async def create_plan(client: AsyncClient, admin: dict[str, str], **overrides: object) -> Any:
    r = await client.post("/admin/subscription-plans", headers=admin, json={**PLAN, **overrides})
    assert r.status_code == 201, r.text
    return r.json()


async def test_admin_creates_plan_and_customer_sees_it_without_staff_pay(
    client: AsyncClient, admin, customer
) -> None:
    plan = await create_plan(client, admin, days_per_week=2)
    assert plan["visits_per_cycle"] == 8
    assert plan["is_active"] is True and plan["replaces_id"] is None
    listed = (await client.get("/subscription-plans", headers=customer)).json()
    assert [p["id"] for p in listed] == [plan["id"]]
    assert "staff_earning_minor" not in listed[0] and "is_active" not in listed[0]
    assert listed[0]["terms"] == PLAN["terms"]


async def test_revision_replaces_the_visible_version(client: AsyncClient, admin, customer) -> None:
    first = await create_plan(client, admin)
    r = await client.post(
        f"/admin/subscription-plans/{first['id']}/versions",
        headers=admin,
        json={**PLAN, "price_minor": 170000},
    )
    assert r.status_code == 201, r.text
    second = r.json()
    assert second["replaces_id"] == first["id"] and second["is_active"] is True
    visible = (await client.get("/subscription-plans", headers=customer)).json()
    assert [(p["id"], p["price_minor"]) for p in visible] == [(second["id"], 170000)]
    versions = (await client.get("/admin/subscription-plans", headers=admin)).json()
    assert [(p["id"], p["is_active"], p["price_minor"]) for p in versions] == [
        (first["id"], False, 160000),
        (second["id"], True, 170000),
    ]
    async with get_sessionmaker()() as s:
        log = (
            await s.execute(select(AuditLog).where(AuditLog.action == "subscription_plan.revised"))
        ).scalar_one()
    assert log.entity_id == second["id"] and log.data == {"replaces_id": first["id"]}


async def test_superseded_version_cannot_be_revised_or_shown(client: AsyncClient, admin) -> None:
    first = await create_plan(client, admin)
    url = f"/admin/subscription-plans/{first['id']}"
    assert (await client.post(f"{url}/versions", headers=admin, json=PLAN)).status_code == 201
    again = await client.post(f"{url}/versions", headers=admin, json=PLAN)
    assert again.status_code == 409 and again.json()["code"] == "plan_superseded"
    show = await client.patch(url, headers=admin, json={"is_active": True})
    assert show.status_code == 409 and show.json()["code"] == "plan_superseded"


async def test_hidden_plan_leaves_the_catalog_and_its_revision_stays_hidden(
    client: AsyncClient, admin, customer
) -> None:
    plan = await create_plan(client, admin)
    hidden = await client.patch(
        f"/admin/subscription-plans/{plan['id']}", headers=admin, json={"is_active": False}
    )
    assert hidden.status_code == 200 and hidden.json()["is_active"] is False
    assert (await client.get("/subscription-plans", headers=customer)).json() == []
    revised = await client.post(f"/admin/subscription-plans/{plan['id']}/versions", headers=admin, json=PLAN)
    assert revised.json()["is_active"] is False


async def test_plan_writes_require_admin_and_valid_values(
    client: AsyncClient, admin, customer, world
) -> None:
    for headers in (customer, world["staff"]):
        assert (await client.post("/admin/subscription-plans", headers=headers, json=PLAN)).status_code == 403
        assert (await client.get("/admin/subscription-plans", headers=headers)).status_code == 403
    for bad in (
        {"days_per_week": 6},
        {"days_per_week": 0},
        {"price_minor": 0},
        {"terms": "   "},
        {"name": ""},
    ):
        r = await client.post("/admin/subscription-plans", headers=admin, json={**PLAN, **bad})
        assert r.status_code == 422, bad
    missing = await client.patch("/admin/subscription-plans/999999", headers=admin, json={"is_active": False})
    assert missing.status_code == 404
