# Task 004 — Mis domicilios (saved customer addresses)

- **Owner:** claude-code · **Branch:** feature/mis-domicilios · **Base SHA:** 94236a9
- **Contracts:** docs/contracts/openapi.json changes (new `/addresses` resource; `BookingCreateRequest.address`
  replaced by `address_id`; `BookingOut.address_id` added). Gap 7 in `docs/rfc/brisa-feature-gaps.md`.

## Objective
Customers keep an address book and pick one of its entries when they book, instead of typing free text
on every booking.

## Scope
- `CustomerAddress`: label, street (calle y número), interior, neighbourhood (colonia), postal code (5 digits),
  municipality (municipio/alcaldía), state, directions (referencias), `is_default`.
- Customer-only endpoints: `GET/POST /addresses`, `PATCH/DELETE /addresses/{id}`. Another customer's address is
  a 404. The first address becomes the default; exactly one default per customer; deleting the default promotes
  the oldest remaining one.
- Bookings take `address_id` and copy the address as one line of text (`Booking.address`), so editing or deleting
  a saved address never rewrites past visits. `Booking.address_id` keeps the link and becomes NULL on delete.
- Mobile: "Mis domicilios" list, add/edit form, set default, delete; booking step 3 picks a saved address
  (or adds one); Inicio shows the default address.

## Not in scope (open decisions)
- Service-area check: decision 7 (service area boundaries) is open. No address is rejected for its location.
- Geocoding / coordinates: needs an ADR (provider, and whether the geofence uses them — decision 5).

## Technical limits (config, not business rules)
- `MAX_ADDRESSES_PER_CUSTOMER` (default 10) caps the address book against abuse → 409 `address_limit`.

## Acceptance
1. `uv run pytest` passes against the worktree MySQL, including ownership, single-default under concurrency,
   snapshot on booking, validation and cap.
2. Migration 0002 upgrades and downgrades cleanly (`alembic downgrade base` runs in the test setup).
3. `pnpm -r typecheck` clean; contract and generated client in sync (`pnpm check:drift`).
4. Mobile flows checked in the browser: add, edit, set default, delete, book with a saved address.
