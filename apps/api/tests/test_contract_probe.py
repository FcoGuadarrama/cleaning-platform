"""Verify the handoff contract and API entry point in the isolated MySQL test suite."""

import json
from pathlib import Path

from httpx import AsyncClient


def test_booking_contract_probe() -> None:
    contract_path = Path(__file__).resolve().parents[3] / "docs/contracts/openapi.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    assert contract["paths"]["/bookings"]["post"]["operationId"] == "bookings_create_hold"


async def test_health_probe(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
