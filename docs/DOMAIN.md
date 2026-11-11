# Domain summary

## Glossary
- **User**: account with exactly one role: `customer`, `staff`, `admin`.
- **StaffProfile**: public profile of a cleaner (display name, bio, active flag). Created only by admin.
- **ServiceOffering**: what is sold (name, duration minutes, price in minor units, currency). Versioned by creating a new row; bookings copy the values.
- **CustomerAddress**: a customer's saved service address (label, street, interior, colonia, postal code,
  municipality, state, directions). Exactly one is the default while any exist.
- **SubscriptionPlan**: a monthly plan customers can see (name, description, weekdays per week 1–5, visit duration,
  monthly price, cleaner pay per visit, terms). Immutable; a change is a new version that replaces the old one
  (`replaces_id`, at most one successor). Visits per cycle = 4 × weekdays per week.
- **Subscription**: a customer's contracted plan: plan version, cleaner, weekdays, one local start time, address
  snapshot, and a copy of the plan as accepted (price, visits, duration, cleaner pay, terms, `terms_accepted_at`).
- **SubscriptionCycle**: four weeks of a subscription starting on a visit date (`starts_on`, inclusive `ends_on`),
  with its price; the next cycle (renewal) starts the day after `ends_on`. A cycle's visits are bookings.
- **Booking**: one scheduled visit (customer, staff, start/end UTC, status, price snapshot, address snapshot). Either a
  single visit (`offering_id`) or a subscription visit (`subscription_cycle_id`, price 0: the cycle is charged).
- **Hold**: a booking in `held` status with `hold_expires_at`; blocks the slot until expiry.
- **Payment**: provider-agnostic record of a charge attempt for a booking or for a subscription cycle (exactly one;
  `provider`, `provider_ref`, status, amount).
- **WebhookEvent**: received provider event, unique on (`provider`, `event_id`) → idempotency.
- **Attendance**: check-in / check-out record with GPS evidence or an explicit capture failure.
- **AttendanceException**: admin resolution of a failed/absent GPS capture (audit trail).
- **Earning**: amount owed to staff for a completed booking (rate snapshot). Belongs to an ISO week (business tz).
- **Settlement**: admin approval of a staff member's earnings for one ISO week. A week can hold several: each approval
  covers what was earned since the last one (e.g. a booking completed after the week was approved).
  **Payout**: recorded transfer for a settlement.
- **AuditLog**: append-only actor/action/entity/payload record.

## States
Booking: `held → confirmed → in_progress → completed`; `held → expired`; `held|confirmed → cancelled`;
`confirmed → no_show_customer` (late cancel / customer-attributable).
Subscription: `held → active`; `held → expired`. Cycle: `held → confirmed | expired`.
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
10. A subscription plan version never changes after creation. Revising hides the old version for good; only the latest
    version of a plan can be shown to customers. Customers never see the cleaner's pay.
11. Contracting holds every visit of the first cycle in one transaction under the cleaner's row lock (invariant 1
    applies to each visit); one taken visit rejects the whole hold. A successful cycle payment confirms the cycle,
    all its held visits and the subscription together, only while the hold is valid; otherwise it is flagged for
    refund. A lapsed hold expires the cycle, its visits and (for the first cycle) the subscription.
12. A subscription keeps the price and terms it accepted; later plan versions never change it. Customers see only
    their own subscriptions and never the cleaner's pay.
