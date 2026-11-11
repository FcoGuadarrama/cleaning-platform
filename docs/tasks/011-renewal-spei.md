# Task 011 — Subscription renewal, cancellation, card + SPEI payments

- **Owner:** claude-code · **Branch:** feature/renewal-spei (from feature/outbox-housekeeping f074e68)
- **Decisions:** owner, 2026-11-11 (recorded in docs/PRODUCT.md, Confirmed).

## Owner decisions
1. Renewal notice on the **last visit day** of the current cycle (e.g. the 4th Monday): the customer is told the
   renewal is charged on the **next business day** and can cancel until then.
2. The cleaner stays **blocked** for the subscription's weekdays and time until the subscription is deactivated.
3. Failed charge (card declined, SPEI transfer not confirmed): retry / remind every business day until the day before
   the first visit of the new cycle; then the subscription is deactivated and the cleaner is free.
4. Cancellation: no further charge, the paid visits of the current cycle stay, no refund; the cleaner is free from
   the next cycle.
5. Notification channel still undecided: every notice is an outbox event, ready for any channel; the app shows it.
6. Payment methods: **card and SPEI only**. SPEI: an agent confirms the transfer in the web dashboard; the slot is
   held **24 h** while waiting.

## Design
- **Commitments (decision 2).** A subscription that is held (unexpired) or active and not cancelled projects its
  weekly visits from the day after its latest live cycle, indefinitely. Projections block like bookings: single
  bookings and availability check them; contracting checks the new pattern against future bookings and other
  projections; renewal materializes the next cycle from its own projection under the cleaner's row lock.
- **Renewal job** (`app.jobs`, every `RENEWAL_INTERVAL_SECONDS`): for each active, non-cancelled subscription whose
  latest confirmed cycle is the last one:
  - on/after the last visit day L: publish `subscription.renewal_notice` once;
  - on/after the charge day C (next business day after L): create cycle N+1 `held` with its visits, deadline = start
    of the first visit day of N+1 (or that visit's start time when C is that day), and charge with the
    subscription's method: card → sandbox charge of the saved card (`SANDBOX_RENEWAL_OUTCOME`); SPEI → pending
    transfer + `subscription.renewal_transfer_due`;
  - each later business day before the deadline: card → new charge attempt if the last one failed; SPEI → reminder;
  - the held cycle lapses at the deadline (hold sweep): cycle and visits expire, subscription `ended` (`unpaid`),
    `subscription.ended` published.
  - Cancelled subscriptions end (`ended`, `cancelled`) the day after their last paid cycle.
- **Cancellation** `POST /subscriptions/{id}/cancel`: sets `cancelled_at`; an unpaid renewal cycle is expired at once;
  no projection beyond the paid cycles.
- **Payments.** `Payment.method` card|spei. Checkout takes `{method}`. SPEI extends the hold to `SPEI_HOLD_HOURS` (24)
  and returns transfer instructions (`SPEI_CLABE`, `SPEI_BANK`, `SPEI_BENEFICIARY` settings; SPEI is unavailable
  until they are set) with a reference. Admin: `GET /admin/transfers`, `POST /admin/payments/{id}/confirm-transfer`,
  `POST /admin/payments/{id}/reject-transfer`. Confirmation runs the same settlement as a provider success (late →
  `needs_refund`).
- **Clients.** Mobile: method choice (card / SPEI) when paying a visit or a plan; SPEI instructions; Mi suscripción
  shows the next charge, the renewal notice, "Pagar ahora" for a pending renewal and "Cancelar suscripción".
  Dashboard: "Transferencias" queue (confirm / reject); subscriptions show cancelled / ended.

## Assumptions (tell the owner)
- Business day = Monday–Friday (as everywhere in the app); public holidays are not considered.
- Card renewals charge a saved card: the sandbox simulates it; a real provider needs a tokenized card (decision 3).
- The agent role is `admin` (permission levels are still open, decision 6).
