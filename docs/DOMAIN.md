# Domain summary

## Glossary
- **User**: account with exactly one role: `customer`, `staff`, `admin`.
- **StaffProfile**: public profile of a cleaner (display name, bio, active flag). Created only by admin.
- **ServiceOffering**: what is sold (name, duration minutes, price in minor units, currency). Versioned by creating a new row; bookings copy the values.
- **CustomerAddress**: a customer's saved service address (label, street, interior, colonia, postal code,
  municipality, state, directions). Exactly one is the default while any exist.
- **Booking**: one scheduled visit (customer, staff, start/end UTC, status, price snapshot, address snapshot).
- **Hold**: a booking in `held` status with `hold_expires_at`; blocks the slot until expiry.
- **Payment**: provider-agnostic record of a charge attempt for a booking (`provider`, `provider_ref`, status, amount).
- **WebhookEvent**: received provider event, unique on (`provider`, `event_id`) → idempotency.
- **Attendance**: check-in / check-out record with GPS evidence or an explicit capture failure.
- **AttendanceException**: admin resolution of a failed/absent GPS capture (audit trail).
- **Earning**: amount owed to staff for a completed booking (rate snapshot). Belongs to an ISO week (business tz).
- **Settlement**: admin approval of a staff member's earnings for one ISO week. **Payout**: recorded transfer for a settlement.
- **AuditLog**: append-only actor/action/entity/payload record.

## States
Booking: `held → confirmed → in_progress → completed`; `held → expired`; `held|confirmed → cancelled`;
`confirmed → no_show_customer` (late cancel / customer-attributable).
Payment: `pending → succeeded | failed`. Attendance capture: `captured | permission_denied | unavailable | network_error`.
Earning: `earned → approved (by settlement) → paid (by payout)`.
Settlement: `approved → paid`.

## Invariants
1. A staff member never has two non-terminal bookings (`held` unexpired, `confirmed`, `in_progress`) whose
   [start − buffer, end + buffer) intervals overlap. Enforced with `SELECT … FOR UPDATE` on the staff row inside the booking transaction.
2. Bookings only Monday–Friday, business tz `America/Mexico_City`, start in the future.
3. A hold confirms only if unexpired and payment succeeded. Replayed webhooks are no-ops.
4. Earnings exist only for `completed` bookings, one per booking, amount copied from the active rate at completion.
5. Changing rates/prices never mutates existing bookings, earnings or accepted terms.
6. Check-out requires check-in. A failed GPS capture is stored as a failure — never as a success —
   and the booking cannot complete until an admin resolves the exception or a successful capture exists.
7. Customers read only their bookings; staff only bookings assigned to them and their own earnings.
8. Money is integer minor units; no floats.
9. A booking uses one of its customer's own saved addresses and copies it as text; editing or deleting the saved
   address never changes the booking's address.
