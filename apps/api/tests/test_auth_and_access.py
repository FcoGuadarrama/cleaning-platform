from httpx import AsyncClient

from tests.conftest import PASSWORD, paid_booking, register


async def test_public_register_is_always_customer(client: AsyncClient) -> None:
    r = await client.post(
        "/auth/register",
        json={"email": "x@test.com", "password": PASSWORD, "full_name": "X", "role": "admin"},
    )
    assert r.status_code == 422  # extra fields are rejected, role cannot be chosen
    headers = await register(client, "y@test.com")
    assert (await client.get("/auth/me", headers=headers)).json()["role"] == "customer"


async def test_roles_enforced_on_server(client, admin, customer, world) -> None:
    assert (await client.post("/admin/staff", headers=customer, json={})).status_code == 403
    assert (await client.get("/admin/staff", headers=world["staff"])).status_code == 403
    assert (await client.get("/bookings")).status_code == 401
    assert (await client.get("/admin/staff", headers=admin)).status_code == 200


async def test_resource_ownership(client: AsyncClient, admin, customer, world) -> None:
    booking_id = await paid_booking(client, customer, world)
    other = await register(client, "other@test.com")
    assert (await client.get(f"/bookings/{booking_id}", headers=other)).status_code == 404
    assert (await client.get("/bookings", headers=other)).json() == []
    assert (await client.get(f"/bookings/{booking_id}", headers=world["staff"])).status_code == 200
    assert len((await client.get("/bookings", headers=admin)).json()) == 1
