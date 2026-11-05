# WORKTREE STATE & HANDOFF LOG
- **Feature:** app-design (visual design for the Expo mobile client, native + web)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-05T23:52:41Z
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

## Immediate context / Handoff notes
Branding is pending: brand.json "Neutral" is a placeholder; screens use tokens only (no hex). Owner forbids gradients.
Customer screens moved to app/(customer)/(tabs)/; book stays in the (customer) stack. Mobile UI is light-only
(NativeWind preset has no dark values yet). Prices in the local DB are demo placeholders, not decisions.

## Verification
- tsc --noEmit (apps/mobile-client): clean. design-tokens tests: 5 pass, 0 fail. (2026-11-05T23:52:41Z)
- Browser (Expo web, revised design): login → home → book (service, day, time, address) → ticket → sandbox pay →
  success → Reservas (segmented) → Cuenta; staff: Servicios hero + next service, Ganancias. Earlier pass (phone width): login → staff list → book (service, day, 10:00, address) → sandbox pay →
  Reservas shows the confirmed booking; Cuenta; staff login shows "Siguiente servicio" + Ganancias. Check-in not
  clicked (browser geolocation prompt). Native iOS/Android device run not done.

## Partial work
- Operations in progress: none. Blockers: none.

## Exact next action
- Owner review on a real phone (Expo Go / dev build) and in the browser; merge/push only with explicit approval.
