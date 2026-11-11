# ADR 0010 — Subscription renewal, cancellation, card + SPEI (2026-11-11, accepted)

**Context.** Owner decisions of 2026-11-11 (docs/PRODUCT.md, Confirmed): notice on the cycle's last visit day, charge
on the next business day, cleaner blocked until the subscription is deactivated, daily retries until the day before
the next cycle's first visit, cancellation at the end of the paid cycle without refund, card and SPEI only, SPEI
confirmed by an agent with a 24 h hold. Only the first cycle was held so far, so a one-off booking could take a
subscriber's slot in cycle 2 (concurrency review, item 6); a 15-minute hold could not wait for a transfer (item 7).

**Commitments.** `app/services/commitments.py`: a subscription that is held (live hold) or active and not cancelled
projects its weekly visits from the day after its latest live cycle, indefinitely. `scheduling.blocking_bookings`
returns bookings plus projected visits, so single bookings and availability respect them; contracting checks the
new pattern against future bookings and other patterns (`Pattern.clash_days`) besides its first cycle. Projections
grow only under the cleaner's row lock (contracting, renewal) and otherwise only shrink, so checks under that lock
hold until commit.

**Renewal job.** `app/services/renewals.py`, started by the lifespan every `RENEWAL_INTERVAL_SECONDS` (900). Per active
subscription, in its own transaction: cleaner lock first (before any plain read, so the REPEATABLE READ snapshot
includes a concurrent run's renewal: a test caught a double charge without this), then subscription and cycles.
Notice (`subscription.renewal_notice`, once per cycle via `outbox.publish_once`) from the last visit day; on the charge
day the next cycle and its visits are created `held` until midnight before its first visit (or that visit's start
when charged the same day), with a payment by the subscription's method. Card: charged after commit through the
sandbox (`SANDBOX_RENEWAL_OUTCOME`), at most once per business day (`Payment.charge_on`). SPEI: a pending transfer and a
daily `subscription.renewal_transfer_due` reminder (a new reference after a rejection). The hold sweep ends a lapsed
renewal as `unpaid` (`subscription.ended`). A cancelled subscription ends the day after its last paid cycle.

**Cancellation.** `POST /subscriptions/{id}/cancel`: `cancelled_at`; a renewal awaiting payment is expired at once (a
late payment for it is flagged for refund); the projection stops after the paid cycles.

**Payments.** `Payment.method` card | spei; checkout takes `{method}` (card by default). SPEI needs `SPEI_CLABE`,
`SPEI_BANK`, `SPEI_BENEFICIARY` (else 409 `spei_unavailable`), extends a single visit's or first cycle's hold to
`SPEI_HOLD_HOURS` (a renewal keeps its deadline), and returns transfer instructions with an 8-character concept
(`app/payments/spei.py`). A pending payment by the other method blocks a switch (`payment_in_progress`). Agents use
`GET /admin/transfers` and `POST /admin/payments/{id}/confirm-transfer | reject-transfer`; confirmation runs the same
settlement as a provider success (`payments._settle`). The sandbox webhook and outcome only touch card payments.

**Lock order.** Every write takes cleaner → payment → subscription → cycle → visits. `_confirm_cycle` now locks the
subscription before the cycle, and the hold sweep locks subscriptions (SKIP LOCKED) before cycles, so cancellation,
renewal, confirmation and expiry cannot deadlock each other.

**Open.** Live provider with tokenized cards (decision 3), refund execution, holidays as non-business days,
notification channel (decision 6), and a renewal blocked by data older than the blocking rule (logged and published
as `subscription.renewal_blocked`, waits for an admin).
