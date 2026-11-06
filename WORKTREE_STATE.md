# WORKTREE STATE & HANDOFF LOG
- **Feature:** app-design (visual design for the Expo mobile client, native + web)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-06T17:56:50Z
- **Branch / Worktree:** feature/app-design (current worktree)
- **Base SHA:** 9e3bf4e
- **Contract Version:** docs/contracts/openapi.json sha256 99336ffb99c2101aa635337ef156a9720934d642afa0e939a2f62b7bf74d4b20 (unchanged)
- **Database:** compose project cp_87c0a5cf (local demo data: 3 offerings, 3 staff test+<name>@test.com, customer test@test.com; DEMO_PASSWORD in .env.worktree)

## Microtask checklist
- [x] 1. Tokens: primary/success/warning/danger `-soft` colors + contrast pairs in brand.json; dist regenerated.
- [x] 2. Dependency: react-native-svg 15.16.0 (SDK 58 bundled version), recorded in docs/VERSIONS.md.
- [x] 3. UI kit (src/ui.tsx, icons.tsx, theme.ts, navigation.tsx, DateBlock.tsx, AccountScreen.tsx).
- [x] 4. Screens: login, register, customer tabs (Personal/Reservas/Cuenta) + book flow, staff tabs (Servicios/Ganancias/Cuenta).
- [x] 5. Web shell public/index.html (mobile-native baseline) + 480 px column on wide viewports.
- [x] 6. docs/DESIGN.md "Mobile client visual language".
- [x] 7. Revision after owner feedback ("toda blanca y básica"; "ningún degradado"): solid primary hero headers with
      bubble motif, raised cards, toned service tiles/avatars, floating tab bar, customer home (next visit, services,
      team), booking step cards + ticket confirmation + success screen, staff hero stats, AuthLayout for login/signup.
      Tokens: accent/on-accent/accent-soft + radius 2xl; no gradients anywhere.
- [x] 8. Production layer after "se ve muy sencillo / app muestra": welcome carousel, cleaner profile with real slots,
      booking + job detail with status timeline, Cómo llegar, next free slot on cards, skeletons, Reanimated motion,
      compact scroll header, staff routes split into (staff)/(tabs) + job/[id].
- [x] 9. "brisa" design 1:1 (owner concept, replaces 1–8 visuals): brand.json → Brisa (teal/aqua, Outfit), flat white
      screens with hairline lists, flat tab bar (Inicio/Visitas/Cuenta), Reservar in 3 steps, Visitas week strip,
      Detalle de visita, Cuenta groups; staff + auth restyled. Unsupported features shown as "Próximamente";
      backlog in docs/rfc/brisa-feature-gaps.md. Deps: expo-font ~58.0.11, @expo-google-fonts/outfit 0.4.2.
      RoleGate now waits for the stored session (deep links no longer 401).
- [x] 10. Fixes found while recording the walkthrough: logout looped ("Maximum update depth exceeded") → role groups
      are Stack.Protected in app/_layout.tsx (RoleGate removed; root waits for the session) and logout leaves the
      group before clearing the user; booking address field collapsed mid-typing at 5 chars → stays open until blur;
      times unified to the 24 h clock (formatTime removed).

## Immediate context / Handoff notes
Brand is "Brisa" from the owner's concept (palette + Outfit); screens use tokens only (no hex). Owner forbids gradients.
Features without backend stay visible as "Próximamente" (owner choice); screen 05 (plan mensual) waits for its RFC.
Customer screens moved to app/(customer)/(tabs)/; book stays in the (customer) stack. Mobile UI is light-only
(NativeWind preset has no dark values yet). Prices in the local DB are demo placeholders, not decisions.

## Verification
- walkthrough pass (2026-11-06): tsc --noEmit (apps/mobile-client) clean. Browser with a fresh test customer: login →
  Inicio → Reservar (service, Ana Lucía, Tue 10 Nov 10:00, typed address kept in full) → sandbox pay → confirmation
  (24 h time) → Detalle → Visitas → Cuenta → Cerrar sesión lands on login with no console errors; deep-link reload
  of /staff/1 still renders. Staff screens still not checked in the browser.
- brisa pass (2026-11-06T17:56:50Z): pnpm -r typecheck clean; design-tokens tests 5 pass / 0 fail; expo export ios+android bundles OK.
  Browser (Expo web, customer test@test.com): Inicio, Visitas (Próximas + Historial), Detalle, Cuenta, Profesional,
  Reservar steps 1–3 → sandbox pay → "Visita confirmada". Staff screens NOT checked in the browser this pass
  (typecheck only). No console errors.
- tsc --noEmit (apps/mobile-client): clean. design-tokens tests: 5 pass, 0 fail. (2026-11-06T15:26:49Z)
- Browser (production layer): welcome → login → home (next slots, compact header) → profile → slot → prefilled book
  → pay → success → booking detail timeline; staff: services → job detail (Cómo llegar, timeline). No console errors.
- Browser (Expo web, revised design): login → home → book (service, day, time, address) → ticket → sandbox pay →
  success → Reservas (segmented) → Cuenta; staff: Servicios hero + next service, Ganancias. Earlier pass (phone width): login → staff list → book (service, day, 10:00, address) → sandbox pay →
  Reservas shows the confirmed booking; Cuenta; staff login shows "Siguiente servicio" + Ganancias. Check-in not
  clicked (browser geolocation prompt). Native iOS/Android device run not done.

## Partial work
- Operations in progress: none. Blockers: none.

## Exact next action
- Owner review on a real phone (Expo Go / dev build) and in the browser; merge/push only with explicit approval.
