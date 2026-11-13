# Task 012 — In-app notifications and push

- **Owner:** claude-code · **Branch:** feature/notifications (from main c2a0c31)
- **Decisions:** owner, 2026-11-13 (recorded in docs/PRODUCT.md, Confirmed).

## Owner decisions
1. Channels: an **in-app inbox** for every role and **push** to the mobile app through the **Expo Push Service**.
2. Recipients: customers and staff (mobile inbox + push) and admins (web dashboard bell + inbox, no push).
3. Preferences: push can be switched off **per category**; the inbox always keeps everything.
4. New notices: **visit reminder** the day before (customer and cleaner) and **new service assigned** (cleaner).

## Design
- **Fan-out.** The outbox (ADR 0009) stays the only source of events. Its channel now turns each event into
  `notifications` rows, one per recipient, rendered from current state when delivered (title and body in es-MX, a
  `data` dict of ids for the deep link). The row is unique on (`source_key`, `user_id`), so a redelivered event
  creates nothing new. Each new row queues one `push.send` outbox message in the same transaction.
- **Push.** The `push.send` message loads the notification, the recipient's active devices and the category
  preference, and posts to Expo (`PUSH_PROVIDER=expo`; `log` locally and in tests). A ticket error
  `DeviceNotRegistered` disables the device; any other failure raises, so the outbox retries and finally marks
  it `dead`. Delivery is at least once: a retry after a partial failure can repeat the push on some devices.
- **Devices.** `PUT /push-devices` registers an Expo token for the caller (a token moves to whoever registers it
  last: one phone, one account); `DELETE /push-devices/{token}` at logout.
- **Preferences.** Categories per role — customer: `visits`, `billing`; staff: `visits`, `payouts`; admin:
  `operations`. Default on. Admins have no push, so no preference screen in the dashboard.
- **Reminders.** Job (`VISIT_REMINDER_INTERVAL_SECONDS`): from `VISIT_REMINDER_LOCAL_TIME` (18:00 business tz)
  publishes `booking.reminder` once for every confirmed visit of the next local day.
- **Retention.** Housekeeping deletes notifications older than `NOTIFICATION_RETENTION_DAYS` (90).

## Events → recipients
| Event | Customer | Cleaner | Admin |
|---|---|---|---|
| `booking.confirmed` | Visita confirmada | Nuevo servicio asignado | — |
| `booking.reminder` (new) | Tu limpieza es mañana | Servicio mañana | — |
| `booking.cancelled` | Visita cancelada | Servicio cancelado (if it was confirmed) | — |
| `booking.completed` | Visita completada | — | — |
| `subscription.cycle_confirmed` | Pago recibido / suscripción activa | Visitas asignadas | — |
| `subscription.renewal_notice` | Tu suscripción se renueva | — | — |
| `subscription.renewal_transfer_due` | Transferencia pendiente | — | — |
| `subscription.cancelled` | Suscripción cancelada | — | — |
| `subscription.ended` | Tu suscripción terminó | Se liberó un horario | — |
| `payment.failed` | No pudimos procesar tu pago | — | — |
| `payment.transfer_pending` (new) | — | — | Transferencia por revisar |
| `payment.needs_refund` | — | — | Reembolso pendiente |
| `subscription.renewal_blocked` | — | — | Renovación bloqueada |
| `attendance.exception_opened` | — | — | Excepción de asistencia |
| `settlement.paid` | — | Pago semanal registrado | — |

## Acceptance
- API tests: fan-out per event and role, idempotent redelivery, push to Expo (mock transport) incl. preference off and
  `DeviceNotRegistered`, device registration ownership, inbox read/unread, reminder job once per visit.
- Mobile: tsc clean; inbox + bell badge (customer and staff), push registration, tap → screen, preferences screen.
- Dashboard: vue-tsc + vitest + build; bell with unread badge and inbox.
- Contract + client regenerated; drift clean.

## Assumptions (tell the owner)
- Reminder time 18:00 the day before (setting). A visit booked after that time for the next day gets both the
  confirmation and the reminder.
- Push text passes through Expo's servers: no addresses or amounts beyond what the notice needs.
- Real devices need an EAS project id and APNs/FCM credentials loaded in EAS; until then push is logged.
