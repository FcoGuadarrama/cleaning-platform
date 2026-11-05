# WORKTREE STATE & HANDOFF LOG
- **Feature:** app-design (visual design for the Expo mobile client, native + web)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-05T23:23:24Z
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

## Immediate context / Handoff notes
Customer screens moved to app/(customer)/(tabs)/; book stays in the (customer) stack. Mobile UI is light-only
(NativeWind preset has no dark values yet). Prices in the local DB are demo placeholders, not decisions.

## Verification
- tsc --noEmit (apps/mobile-client): clean. design-tokens tests: 5 pass, 0 fail. (2026-11-05T23:23:24Z)
- Browser (Expo web, phone-width viewport): login → staff list → book (service, day, 10:00, address) → sandbox pay →
  Reservas shows the confirmed booking; Cuenta; staff login shows "Siguiente servicio" + Ganancias. Check-in not
  clicked (browser geolocation prompt). Native iOS/Android device run not done.

## Partial work
- Operations in progress: none. Blockers: none.

## Exact next action
- Owner review on a real phone (Expo Go / dev build) and in the browser; merge/push only with explicit approval.
