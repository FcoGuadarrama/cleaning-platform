"""Customer address book. Every write locks the customer's user row, so the one-default rule and the
per-customer cap hold under concurrent requests."""

from collections.abc import Sequence

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import retry_on_lock_conflict
from app.core.errors import conflict, not_found
from app.models import CustomerAddress, User
from app.schemas import AddressCreateRequest, AddressUpdateRequest


def _owned(customer: User) -> ColumnElement[bool]:
    return CustomerAddress.customer_id == customer.id


async def _lock_customer(session: AsyncSession, customer: User) -> None:
    await session.execute(select(User.id).where(User.id == customer.id).with_for_update())


async def get_owned(session: AsyncSession, customer: User, address_id: int) -> CustomerAddress:
    """Another customer's address is reported as missing, never as forbidden."""
    row = await session.execute(
        select(CustomerAddress).where(CustomerAddress.id == address_id, _owned(customer))
    )
    address = row.scalar_one_or_none()
    if address is None:
        raise not_found("Address")
    return address


async def _clear_default(session: AsyncSession, customer: User) -> None:
    # Find the rows with a plain read, then update by primary key: a ranged UPDATE on customer_id
    # takes gap locks that deadlock with other customers' inserts. The user-row lock already
    # serialises this customer's writers.
    ids = (
        await session.scalars(select(CustomerAddress.id).where(_owned(customer), CustomerAddress.is_default))
    ).all()
    if ids:
        await session.execute(
            update(CustomerAddress).where(CustomerAddress.id.in_(ids)).values(is_default=False)
        )


async def list_addresses(session: AsyncSession, customer: User) -> Sequence[CustomerAddress]:
    rows = await session.execute(
        select(CustomerAddress)
        .where(_owned(customer))
        .order_by(CustomerAddress.is_default.desc(), CustomerAddress.id)
    )
    return rows.scalars().all()


@retry_on_lock_conflict
async def create_address(
    session: AsyncSession, customer: User, body: AddressCreateRequest
) -> CustomerAddress:
    async with session.begin():
        await _lock_customer(session, customer)
        count = await session.scalar(
            select(func.count()).select_from(CustomerAddress).where(_owned(customer))
        )
        if (count or 0) >= get_settings().max_addresses_per_customer:
            raise conflict("address_limit", "Address book is full")
        # The first address is the default whether or not the customer asked for it.
        make_default = body.is_default or count == 0
        if make_default:
            await _clear_default(session, customer)
        address = CustomerAddress(
            customer_id=customer.id, **body.model_dump(exclude={"is_default"}), is_default=make_default
        )
        session.add(address)
    return address


@retry_on_lock_conflict
async def update_address(
    session: AsyncSession, customer: User, address_id: int, body: AddressUpdateRequest
) -> CustomerAddress:
    async with session.begin():
        await _lock_customer(session, customer)
        address = await get_owned(session, customer, address_id)
        changes = body.model_dump(exclude_unset=True, exclude={"is_default"})
        for field, value in changes.items():
            setattr(address, field, value)
        if body.is_default:
            await _clear_default(session, customer)
            address.is_default = True
    return address


@retry_on_lock_conflict
async def delete_address(session: AsyncSession, customer: User, address_id: int) -> None:
    """Past bookings keep their address text; their link to the deleted row becomes NULL."""
    async with session.begin():
        await _lock_customer(session, customer)
        address = await get_owned(session, customer, address_id)
        was_default = address.is_default
        await session.delete(address)
        await session.flush()
        if was_default:
            oldest = await session.scalar(
                select(CustomerAddress).where(_owned(customer)).order_by(CustomerAddress.id).limit(1)
            )
            if oldest is not None:
                oldest.is_default = True
