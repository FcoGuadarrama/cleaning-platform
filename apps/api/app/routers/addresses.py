from fastapi import APIRouter, Response

from app.core.errors import ERROR_RESPONSES
from app.deps import CustomerDep, SessionDep
from app.schemas import AddressCreateRequest, AddressOut, AddressUpdateRequest
from app.services import addresses

router = APIRouter(tags=["addresses"], responses=ERROR_RESPONSES)


@router.get("/addresses", name="addresses_list")
async def list_addresses(session: SessionDep, user: CustomerDep) -> list[AddressOut]:
    """The caller's saved addresses, default first."""
    return [AddressOut.model_validate(a) for a in await addresses.list_addresses(session, user)]


@router.post("/addresses", status_code=201, name="addresses_create")
async def create_address(body: AddressCreateRequest, session: SessionDep, user: CustomerDep) -> AddressOut:
    return AddressOut.model_validate(await addresses.create_address(session, user, body))


@router.patch("/addresses/{address_id}", name="addresses_update")
async def update_address(
    address_id: int, body: AddressUpdateRequest, session: SessionDep, user: CustomerDep
) -> AddressOut:
    return AddressOut.model_validate(await addresses.update_address(session, user, address_id, body))


@router.delete("/addresses/{address_id}", status_code=204, name="addresses_delete")
async def delete_address(address_id: int, session: SessionDep, user: CustomerDep) -> Response:
    await addresses.delete_address(session, user, address_id)
    return Response(status_code=204)
