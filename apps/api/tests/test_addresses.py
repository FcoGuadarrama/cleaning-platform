import asyncio

from httpx import AsyncClient

from app.core.config import get_settings
from tests.conftest import ADDRESS, future_weekday, hold, register, saved_address


async def test_first_address_becomes_default(client: AsyncClient, customer) -> None:
    first = await saved_address(client, customer)
    second = await saved_address(client, customer, label="Oficina")
    assert first["is_default"] is True
    assert second["is_default"] is False
    listed = (await client.get("/addresses", headers=customer)).json()
    assert [a["label"] for a in listed] == ["Casa", "Oficina"]


async def test_only_one_default(client: AsyncClient, customer) -> None:
    await saved_address(client, customer)
    office = await saved_address(client, customer, label="Oficina", is_default=True)
    r = await client.patch(f"/addresses/{office['id']}", headers=customer, json={"street": "Otra 9"})
    assert r.status_code == 200
    assert r.json()["is_default"] is True
    listed = (await client.get("/addresses", headers=customer)).json()
    assert [(a["label"], a["is_default"]) for a in listed] == [("Oficina", True), ("Casa", False)]


async def test_concurrent_defaults_leave_exactly_one(client: AsyncClient, customer) -> None:
    created = [await saved_address(client, customer, label=f"Casa {i}") for i in range(4)]
    await asyncio.gather(
        *(client.patch(f"/addresses/{a['id']}", headers=customer, json={"is_default": True}) for a in created)
    )
    listed = (await client.get("/addresses", headers=customer)).json()
    assert sum(a["is_default"] for a in listed) == 1


async def test_deleting_default_promotes_oldest(client: AsyncClient, customer) -> None:
    home = await saved_address(client, customer)
    office = await saved_address(client, customer, label="Oficina")
    await saved_address(client, customer, label="Mamá")
    assert (await client.delete(f"/addresses/{home['id']}", headers=customer)).status_code == 204
    listed = (await client.get("/addresses", headers=customer)).json()
    assert listed[0]["id"] == office["id"]
    assert listed[0]["is_default"] is True


async def test_validation(client: AsyncClient, customer) -> None:
    bad_zip = await client.post("/addresses", headers=customer, json={**ADDRESS, "postal_code": "9170"})
    assert bad_zip.status_code == 422
    blank = await client.post("/addresses", headers=customer, json={**ADDRESS, "street": "   "})
    assert blank.status_code == 422
    home = await saved_address(client, customer, label="  Casa  ")
    assert home["label"] == "Casa"
    null = await client.patch(f"/addresses/{home['id']}", headers=customer, json={"street": None})
    assert null.status_code == 422
    unset = await client.patch(f"/addresses/{home['id']}", headers=customer, json={"is_default": False})
    assert unset.status_code == 422


async def test_address_book_cap(client: AsyncClient, customer) -> None:
    for i in range(get_settings().max_addresses_per_customer):
        await saved_address(client, customer, label=f"Casa {i}")
    r = await client.post("/addresses", headers=customer, json=ADDRESS)
    assert r.status_code == 409
    assert r.json()["code"] == "address_limit"


async def test_addresses_are_private(client: AsyncClient, customer, world) -> None:
    home = await saved_address(client, customer)
    other = await register(client, "other@test.com")
    assert (await client.get("/addresses", headers=other)).json() == []
    url = f"/addresses/{home['id']}"
    assert (await client.patch(url, headers=other, json={"label": "Mía"})).status_code == 404
    assert (await client.delete(url, headers=other)).status_code == 404
    assert (await client.get("/addresses", headers=world["staff"])).status_code == 403
    booking = await client.post(
        "/bookings",
        headers=other,
        json={
            "staff_id": world["staff_id"],
            "offering_id": world["offering_id"],
            "starts_at": future_weekday().isoformat(),
            "address_id": home["id"],
        },
    )
    assert booking.status_code == 404


async def test_booking_keeps_address_snapshot(client: AsyncClient, customer, world) -> None:
    home = await saved_address(client, customer, interior="4B")
    booking = (await hold(client, customer, world, future_weekday())).json()
    assert booking["address_id"] == home["id"]
    expected = "Calle Prueba 123, int. 4B, Centro, C.P. 91700, Veracruz, Veracruz"
    assert booking["address"] == expected

    await client.patch(f"/addresses/{home['id']}", headers=customer, json={"street": "Nueva 1"})
    again = (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()
    assert again["address"] == expected

    await client.delete(f"/addresses/{home['id']}", headers=customer)
    gone = (await client.get(f"/bookings/{booking['id']}", headers=customer)).json()
    assert gone["address"] == expected
    assert gone["address_id"] is None
