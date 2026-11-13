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
  app.
- Subscription cycle (owner, 2026-11-10): the cycle starts with the first visit, not with the payment, and lasts four
  weeks (choosing Monday gives the four Mondays from the first visit); the next cycle starts the day after. If the
  assigned cleaner cannot cover a visit of the next cycle, another cleaner covers it provisionally. Customers
  contract in the app (task 007).
- Renewal (owner, 2026-11-11, task 011): on the last visit day of the cycle (e.g. the 4th Monday) the customer is
  notified that the renewal is charged on the next business day and can cancel until then. The cleaner stays blocked
  for the subscription's weekdays and time until the subscription is deactivated. A failed charge (declined card, SPEI
  not confirmed) is retried / reminded every business day until the day before the first visit of the new cycle;
  then the subscription ends and the cleaner is free.
- Cancellation (owner, 2026-11-11): no further charge, the paid visits of the current cycle stay, no refund; the
  cleaner is free from the next cycle.
- Payment methods (owner, 2026-11-11): card and SPEI only. A SPEI transfer is confirmed by an agent in the web
  dashboard; the slot (or the plan's first cycle) is held 24 h while waiting.

## Proposals (reversible defaults used in code until decided)
| Topic | Default | Where |
|---|---|---|
| Payment provider | `sandbox` provider adapter only; no live keys | `apps/api/app/payments/` |
| Checkout hold TTL | 15 min (card); SPEI 24 h (decided) | `HOLD_TTL_MINUTES`, `SPEI_HOLD_HOURS` settings |
| SPEI business account | unset: SPEI checkout answers `spei_unavailable` | `SPEI_CLABE`, `SPEI_BANK`, `SPEI_BENEFICIARY` |
| Business days for renewal | Monday–Friday, public holidays not modelled | `app/services/recurrence.py` |
| Renewal charge | sandbox charges the "saved card" (`SANDBOX_RENEWAL_OUTCOME`) | needs a tokenized card from the provider |
| Travel buffer | 60 min between visits of the same cleaner | `TRAVEL_BUFFER_MINUTES` setting |
| Service duration | admin-defined per `ServiceOffering` (no default offering seeded as a "real" price) | DB |
| Subscription start time | one local start time for every visit of a subscription | `subscriptions.visit_start` |
| Subscription first visit | at most 28 days ahead | `SUBSCRIPTION_START_WINDOW_DAYS` setting |
| GPS poor accuracy | > 100 m flagged as `low_accuracy` (still recorded, not auto-rejected) | setting |
| Earnings amount | admin-defined `EarningRate` versioned; none seeded in prod | DB |
| Notifications | events queued in the outbox, delivered to the log only; the app shows renewal notices | ADR 0009, `NOTIFICATION_CHANNEL` |

## Open decisions (block only the noted flow)
1. Prices, durations, travel buffer — blocks pilot pricing, not sandbox.
2. ~~"Four monthly visits" vs "every selected weekday"~~ — **decided 2026-11-10: four visits per chosen weekday per four-week cycle that starts with the first visit and renews on the same weekday right after** (see Confirmed).
3. Payment provider (card tokenization for renewals), refund execution, pause subscription — blocks live payments.
   Failed renewals, cancellation and the methods (card + SPEI) were decided 2026-11-11 (see Confirmed).
4. Cleaner compensation for late cancellation / customer-attributable failure.
5. Geofence radius, GPS data retention, automatic payment consequences of GPS.
6. Exact admin permission levels, staff verification, notification channels, incident handling SLAs.
7. Kit content/price/delivery; service area boundaries.

## Release stages
local demo → staging (sandbox payments) → pilot (owner approval, real staff, sandbox or live per decision 3) → store distribution → live payments.
