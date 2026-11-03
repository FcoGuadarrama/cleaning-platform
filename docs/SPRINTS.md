# Sprints — vertical, demonstrable increments

Stages: **local demo** → **staging** (sandbox payments) → **pilot** (owner approval) → **store distribution** → **live payments**.

## Sprint 1 — single-visit vertical slice (local demo) — *implemented on `feat/monorepo-platform-foundation`*
Acceptance (all against real MySQL):
1. Admin provisions staff + service offering + earning rate (dashboard / `admin_*`). ✅ API + dashboard
2. Customer registers/logs in (mobile), browses staff and availability, holds a slot, pays in sandbox → confirmed. ✅
3. Overlapping/concurrent bookings rejected (row lock + buffer); webhook replay is a no-op. ✅ tests
4. Staff sees the assignment; check-in/out with foreground GPS; failed capture recorded as failure. ✅
5. Admin resolves GPS exceptions (audit trail); completion creates one `earned` entry for the ISO week. ✅
6. Admin approves weekly settlement (`approved`) and records payout (`paid`); three amounts shown separately. ✅
7. `scripts/smoke-e2e.sh` drives 1–6 over HTTP. ✅ ran locally
Not yet: on-device run of the mobile app against the API (manual QA on simulator pending), staging deploy.

## Sprint 2 — customer self-service + staging
Cancellation (≥24 h free / <24 h charged per DOMAIN), reschedule within cycle, replacement cleaner when staff
unavailable, incident reporting by staff, review after completion + report/moderation queue, staging host + deploy.

## Sprint 3 — subscriptions (calendar + sandbox only)
Versioned subscription terms, weekday recurrence preview (shows every occurrence, incl. 5th weekday), accepted-terms
snapshot, sandbox renewals. **Live recurring billing blocked on open decision #2 and #3** (`docs/PRODUCT.md`).

## Sprint 4 — pilot hardening
Real payment provider adapter (after decision), notifications channel, admin permission levels, backup schedule +
off-host encryption, monitoring/alerts, EAS builds for internal testers (TestFlight / Play internal track).

## Sprint 5 — store distribution + live payments (owner approval gates)
