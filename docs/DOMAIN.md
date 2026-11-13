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
- **IdempotencyKey**: a client's `Idempotency-Key` for one create, unique per user; maps a retry to the resource the
  first attempt created. Deleted after `IDEMPOTENCY_KEY_TTL_HOURS` (24).
- **OutboxMessage**: an event for the outside world (`booking.confirmed`, `booking.cancelled`, `booking.completed`,
  `subscription.cycle_confirmed`, `payment.failed`, `payment.needs_refund`, `attendance.exception_opened`,
  `settlement.paid`), written with the change that caused it; key `topic:subject id`, payload ids only.
- **Notification**: one notice in a user's inbox (category, title, body, ids for the deep link, read time), rendered
  when its outbox event was delivered; unique per event and recipient. Deleted after `NOTIFICATION_RETENTION_DAYS`.
- **PushDevice**: an Expo push token of a signed-in customer or cleaner; disabled at sign-out or when Expo reports it
  unregistered. **NotificationPreference**: a category whose push the user muted (no row = on).
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
Subscription: `held → active`; `held → expired`; `active → ended` (`cancelled` after the paid cycles, or `unpaid` when a
renewal lapses). `cancelled_at` marks a cancellation that has not ended yet. Cycle: `held → confirmed | expired` (a
renewal cycle is created `held` on its charge day). Payment: `pending → succeeded | failed`; method `card | spei`. Attendance capture: `captured | permission_denied | unavailable | network_error`.
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
13. A retried hold creation with the same `Idempotency-Key` and body never creates a second hold; it returns the
    first. The same key with a different body is rejected.
14. Only a duplicate `WebhookEvent` is acknowledged as a replay; any other failure while applying an event leaves no
    trace, so a redelivery applies it.
15. Recording a check-in or check-out again returns the stored record when the same user recorded it (the first
    capture wins) and is rejected when someone else did; it never opens a second exception or a second earning.
16. Releasing lapsed holds never waits on, or undoes, a transaction working on the same hold: a held row is skipped
    and swept later, and a cycle being confirmed keeps its visits.
17. An outbox message exists if and only if the change that caused it committed, at most one per topic and subject.
    It is delivered at least once and in no guaranteed order; a message that keeps failing ends `dead`, never lost.
18. A subscription that is held (live hold) or active and not cancelled blocks its cleaner on its weekdays and time in
    every future week, also before that cycle exists: no booking, contract or renewal may clash with it.
19. A renewal is charged at most once per business day, and only between its charge day and the day before the new
    cycle's first visit; unpaid then, the subscription ends `unpaid` and frees the cleaner. A cancelled subscription
    is never charged again.
20. Only an agent (admin) confirms or rejects a SPEI payment; the sandbox and the provider webhook never settle it.
    A confirmation after the hold lapsed records the money and flags a refund; it books nothing.
21. Lock order for every write: cleaner (staff row) → payment → subscription → cycle → visits (bookings).
22. A notification reaches only its recipient: inbox reads and marks are scoped to the caller, and a push goes only to
    devices the recipient registered, never for a category they muted. One outbox event gives at most one notification
    per recipient.
