# Product scope

## Confirmed
- One cleaning company, own employed staff, one brand; launch Veracruz metro (municipalities TBD), multi-city later.
- ~2 services/day, 4 cleaners at launch.
- iOS + Android: one role-aware app (customer / staff). Web dashboard for administration.
- Server-side roles + resource ownership. Public signup → customer only. Staff provisioned by admin.
- Free customer accounts. Single visits and auto-renewing subscriptions, paid in-app via a provider suitable for physical services.
- Customers browse staff profiles, availability, ratings/reviews and choose the cleaner. Reviews only after completed service; reporting + moderation.
- Services Monday–Friday. Subscription = recurring weekday + same cleaner; visits are scheduled (no credits); dates shown before purchase; renewal keeps recurrence.
- Cleaner unavailable → customer chooses replacement or reschedule.
- ≥24 h notice: move one visit to another available date within the same billing cycle; others unchanged.
- <24 h cancellation or customer-attributable failure → single visit charged / subscription visit consumed.
- Staff: controlled login, assigned schedule, incidents, GPS-assisted check-in/out (foreground only), current-week earnings. Offline deferred.
- Weekly settlement; fixed amount per completed service. Completion, payment, earning, approved settlement and payout are separate records.
- Customer supplies tools/products; optional extra kit.
- Admin configures subscription prices/terms; terms are versioned; accepted version preserved per purchase; no retroactive changes.
- Subscription plans (owner, 2026-11-10): fixed monthly price; each plan sets 1–5 weekdays per week; a cycle has four
  visits per chosen weekday, and a month with a fifth occurrence adds no visit. Customers see published plans in the
  app; contracting waits for the payment provider (Stripe, not connected yet).

## Proposals (reversible defaults used in code until decided)
| Topic | Default | Where |
|---|---|---|
| Payment provider | `sandbox` provider adapter only; no live keys | `apps/api/app/payments/` |
| Checkout hold TTL | 15 min | `HOLD_TTL_MINUTES` setting |
| Travel buffer | 60 min between visits of the same cleaner | `TRAVEL_BUFFER_MINUTES` setting |
| Service duration | admin-defined per `ServiceOffering` (no default offering seeded as a "real" price) | DB |
| GPS poor accuracy | > 100 m flagged as `low_accuracy` (still recorded, not auto-rejected) | setting |
| Earnings amount | admin-defined `EarningRate` versioned; none seeded in prod | DB |
| Notifications | none (in-app state only) | — |

## Open decisions (block only the noted flow)
1. Prices, durations, travel buffer — blocks pilot pricing, not sandbox.
2. ~~"Four monthly visits" vs "every selected weekday"~~ — **decided 2026-11-10: four visits per chosen weekday per monthly cycle** (see Confirmed). Cycle start date and renewal day are still open.
3. Payment provider, failed payments, refunds, pause/cancel subscription — blocks live payments.
4. Cleaner compensation for late cancellation / customer-attributable failure.
5. Geofence radius, GPS data retention, automatic payment consequences of GPS.
6. Exact admin permission levels, staff verification, notification channels, incident handling SLAs.
7. Kit content/price/delivery; service area boundaries.

## Release stages
local demo → staging (sandbox payments) → pilot (owner approval, real staff, sandbox or live per decision 3) → store distribution → live payments.
