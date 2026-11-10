# Brisa design: features without backend (RFC/ADR backlog)

Source: owner-supplied "brisa" product concept, 6 customer screens (01 Inicio, 02 Visitas, 03 Cuenta, 04 Reservar,
05 Plan mensual, 06 Tu visita), implemented in the mobile client on 2026-11-06. The concept itself is labelled
"precios y datos ilustrativos", so its sample values (prices, kit cost, dates) are not product decisions.

Each feature the design shows but the product cannot do yet is shown in the app as **"Próximamente"**: the entry is
there, but it cannot be tapped (`Soon` and the `soon` props in `apps/mobile-client/src/ui.tsx`). Screen 05 exists as a
plan catalog (section 1). Each section below is one RFC candidate. **Blocked by** points to an open decision in `docs/PRODUCT.md`;
**ADRs** lists the architecture choices the RFC will force.

Already backed by data (no RFC needed): next visit, service catalog (name, duration, price), cleaner choice and real
availability, sandbox payment, visit status, saved addresses (gap 7), "customer supplies products", "Mon–Fri",
24 h change notice (confirmed rule, shown only as text).

## 1. Subscription / monthly plan (screen 05, "Conoce el plan mensual", "Mi suscripción")
- **Done (task 006):** versioned `SubscriptionPlan` catalog, admin view, customer list + detail with terms.
  Decision 2 is settled (four visits per chosen weekday). Still missing below: purchase, cycles, renewal, checkout.
- Design: 4 dated visits per cycle, same weekday, time and cleaner. Shows the dates before payment, renews
  automatically, and states "Sin quinta visita automática".
- Blocked by: open decision 2 ("four monthly visits" vs "every selected weekday"; the design assumes four),
  decision 3 (provider, failed payments, pause/cancel), and admin-configured versioned prices/terms (confirmed).
- Needs: `Subscription`, `SubscriptionCycle`, `PlanTerms` (versioned, accepted version per purchase), visit
  generation per cycle, renewal job, recurring checkout.
- ADRs: recurring-billing model and provider; cycle/visit generation (scheduled job vs on-demand); terms versioning.

## 2. Reschedule a visit ("Cambiar fecha" on Visitas and Detalle)
- Confirmed rule: with ≥24 h notice, a visit moves to another available date in the same billing cycle; <24 h is
  charged or consumed. The UI shows the rule as text only.
- Needs: `POST /bookings/{id}/reschedule` reusing the ADR 0002 lock and overlap check, policy evaluation in the
  business time zone, audit trail.
- Blocked by: decision 4 (cleaner pay when a visit is cancelled late).
- ADRs: in-place booking change vs cancel + rebook (payments, earnings and audit records).

## 3. Replacement when the cleaner is unavailable ("Solicitar reemplazo")
- Confirmed: the customer chooses a replacement or a new date.
- Needs: an unavailability record (admin or staff), a customer prompt, reassignment that keeps the payment.
- ADRs: who can mark a cleaner unavailable; notification channel (see 6).

## 4. Ratings and reviews ("Califica el servicio", Visitas → "Después de tu visita")
- Confirmed: reviews only after a completed service, with reporting and moderation.
- Needs: `Review` (booking 1:1, stars, text), report flow, admin moderation, aggregate on the staff profile.
- ADRs: moderation workflow and visibility rules.

## 5. Customer ↔ cleaner messaging ("Mensaje" on Detalle)
- Not in product scope yet. Decide first whether it is in-app chat, masked phone, or support only.
- ADRs: real-time transport (polling vs WebSocket) on the FastAPI monolith; retention and privacy of messages.

## 6. Notifications (bell with badge on Inicio, "Notificaciones y privacidad")
- PRODUCT.md default: none (in-app state only). Blocked by decision 6 (notification channels).
- Needs: device token registration (Expo push), notification preferences, event outbox.
- ADRs: push provider (Expo Push Service vs APNs/FCM direct); outbox/background worker.

## 7. Saved addresses ("Mi casa · Veracruz" selector, "Mis domicilios", "Domicilio · Editar")
- **Built** (task 004, `docs/tasks/004-mis-domicilios.md`): `CustomerAddress` address book with one default,
  `/addresses` CRUD, booking by `address_id` with a text snapshot, Mis domicilios screens, booking picker,
  default address on Inicio.
- Still open: the service-area check, blocked by decision 7 (service area boundaries).
- ADRs: geocoding provider (or none); whether the geofence uses the address's coordinates (relates to decision 5).

## 8. Cleaning preferences and per-visit instructions ("Preferencias de limpieza", "Indicaciones": Mascotas, Prioridad)
- Needs: preferences per address (pets, surfaces, priorities) plus a per-visit override, shown to staff on the job
  detail screen.
- ADRs: free text vs structured fields (affects staff UI and admin reporting).

## 9. Service scope checklist ("Tu casa, a tu manera", "Ver qué incluye")
- Offerings have no task list. Needs: admin-managed checklist per offering (and optionally per visit, ticked by staff).
- ADRs: checklist versioning when an offering's scope changes after purchase.

## 10. Optional cleaning kit ("Agregar kit de limpieza · +$80")
- Confirmed as optional; blocked by decision 7 (kit content, price, delivery).
- Needs: booking add-ons (line items) with their own price in minor units; the checkout total includes them.
- ADRs: line-item model on bookings/payments.

## 11. Saved payment methods ("Visa •••• 4242 · Cambiar", "Métodos de pago")
- Blocked by decision 3 (provider). Card data stays with the provider (tokenised); the API stores only references.
- ADRs: provider choice and PCI scope (hosted fields vs redirect).

## 12. Receipts and invoices ("Recibos y facturas")
- Needs: a receipt per successful payment; Mexican CFDI invoicing if offered (RFC, tax regime, PAC provider).
- ADRs: CFDI provider and when invoices are issued; storage of fiscal data.

## 13. Support and incidents ("Soporte e incidencias", "¿Cambió tu semana? · Hablar con soporte", "Ayuda con mi visita")
- Confirmed for staff (incidents); not defined for customers. Blocked by decision 6 (incident SLAs).
- Needs: `Incident` / support ticket linked to a booking, admin queue in the dashboard.
- ADRs: in-house ticketing vs external helpdesk.

## 14. Profile editing and photos ("Editar perfil", staff and customer photos)
- Avatars use initials today. Needs: profile update endpoint, image upload and storage, staff photos moderated by admin.
- ADRs: object storage (local volume vs S3-compatible) and image processing.

## 15. "Mi profesional habitual"
- The design implies a stored preferred cleaner. The app currently derives it from the customer's most-booked
  cleaner (`usualStaffId` in `apps/mobile-client/src/visits.ts`). A subscription (1) fixes the cleaner.
- Decide: is it a stored preference, or always derived?

## Design assets (not features)
- Brand photography (interiors on Inicio and Reservar): `HomeScene` in `src/illustrations.tsx` is a token-drawn
  stand-in.
- Drawn logo: the wordmark is set in Outfit until `brand.json` `assets.logo` exists.
