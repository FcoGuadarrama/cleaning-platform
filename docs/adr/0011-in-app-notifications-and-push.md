# ADR 0011 — In-app notifications and Expo push (2026-11-13, accepted)

**Context.** The owner decided the notification channels (task 012, part of open decision 6): an in-app inbox for every
role, push to the mobile app through the Expo Push Service, push muted per category, plus a day-before visit reminder
and a notice to the cleaner for each new service. ADR 0009 already queues every event in the outbox.

**Fan-out.** `outbox.dispatch(session, deliver)` now takes its delivery function; the jobs pass
`notifications.deliver`. For an event it renders one `Notice` per recipient from current state (es-MX title and body,
`data` with the ids for the deep link) and inserts a `notifications` row, unique on (`source_key` = outbox key,
`user_id`): a redelivered event adds nothing. Each new row for a customer or cleaner queues a `push.send:<id>` outbox
message in the same transaction; admins get inbox rows only. Recipients and texts are task 012's table. Events added:
`booking.reminder`, `payment.transfer_pending` (a SPEI payment was created); `booking.cancelled` carries
`was_confirmed` so the cleaner is told only about visits they knew of.

**Push.** `push.send` loads the notification, checks the recipient's preference for its category and posts one message
per active device to `https://exp.host/--/api/v2/push/send` (`PUSH_PROVIDER=expo`, optional `EXPO_ACCESS_TOKEN`;
`log` locally and in tests, which logs counts only). A `DeviceNotRegistered` ticket disables the device; any other
error fails the delivery, so the outbox retries with backoff and finally marks it `dead`. At least once: a retry after
a partial failure can repeat the push on devices that already got it. Push text passes through Expo: it names the
cleaner and the time, never the address.

**Devices and preferences.** `PUT /push-devices` (customer, staff) upserts an Expo token for the caller; the token
moves to whoever registers it last, and beyond 10 active devices per user the oldest are disabled. The app removes it
with `DELETE /push-devices/{token}` before signing out. `notification_preferences` stores only explicit choices (no
row = on); categories per role: customer `visits`, `billing`; staff `visits`, `payouts`; admin `operations`.

**Reminders and retention.** `reminders.run` (every `VISIT_REMINDER_INTERVAL_SECONDS`) publishes `booking.reminder`
once per confirmed visit of the next local day, from `VISIT_REMINDER_LOCAL_TIME` (18:00). Housekeeping deletes
notifications older than `NOTIFICATION_RETENTION_DAYS` (90). Migration 0009 adds the three tables.

**Clients.** Mobile: `InboxProvider` (unread count on sign-in, foreground and push received), bell with badge on both
homes, inbox screen, "Notificaciones" settings (OS permission + switches), taps open the booking / subscription /
earnings screen. Dashboard: bell with badge and the latest 20 notices in the header, polled with the live data, each
linking to the page that resolves it.

**Open.** Expo push receipts are not polled (only ticket errors disable devices). Real devices need an EAS project id
(`extra.eas.projectId`) and APNs/FCM credentials uploaded to EAS; until then the app skips registration. No email or
WhatsApp channel.
