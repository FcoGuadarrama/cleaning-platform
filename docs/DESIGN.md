# Design system

## Tokens (`@repo/design-tokens`)
One canonical file: `packages/design-tokens/src/brand.json`, validated by `brand.schema.json` (Ajv) and by a WCAG
contrast check over the pairs listed in `contrast` (build fails below 4.5:1). `pnpm --filter @repo/design-tokens build`
generates (never hand-edit):

| Output | Consumer |
|---|---|
| `dist/tokens.css` | CSS custom properties, light + `prefers-color-scheme: dark` |
| `dist/tailwind-theme.css` | Tailwind 4 `@theme` for the dashboard |
| `dist/nativewind-preset.cjs` | NativeWind 4 preset (mobile uses Tailwind 3.4.19, as NativeWind 4 requires) |
| `dist/native.js` + `.d.ts` | raw values for React Native APIs that cannot use classes |

Semantic names only (`primary`, `on-primary`, `surface`, `text-muted`, `danger`…); screens never use hex values.
Categories: color (light/dark), typography (family, size, line height, weight), spacing, radius, elevation,
`minTouchTarget` (44 pt), component variants (button sizes/intents), asset references.

## What a brand change does — and does not — update
- **Rebuild only** (`build` + web deploy / mobile JS update): colors, type scale, spacing, radii, elevation, variants.
- **Asset update + new native build / store submission**: app icon, splash, bundled fonts (`typography.family`
  other than `System`), app name, store listing metadata. `assets` holds references, not the binaries' rollout.
- Native UI chrome (status bar style, navigation bar colors) follows tokens at runtime where Expo exposes it.

## Accessibility
- Contrast ≥ 4.5:1 enforced at build. Dynamic Type / font scaling left enabled (no `allowFontScaling={false}`).
- Touch targets ≥ 44×44 pt; keyboard focus rings use `focus` token on web; every icon-only control has an
  `aria-label` / `accessibilityLabel`; form errors are announced (`role="alert"` / `accessibilityLiveRegion`).
- Every data view handles loading, empty, error (with retry) and disabled states (`AsyncState.vue`, mobile equivalents).

## Dashboard components (shadcn-vue)
`apps/web-dashboard/src/components/ui/` holds shadcn-vue components (Reka UI primitives) copied by the CLI and
then owned here: edit them freely, do not re-run `add` over local changes. `src/style.css` maps every shadcn
variable (`--color-foreground`, `--color-muted`, `--color-ring`…) to a brand token, so the dashboard has no colors of
its own; tints are `color-mix()` of a token. Conventions:
- Status colour comes from `BOOKING_STATUS` tones in `src/viewmodels/format.ts` (`StatusBadge`, agenda blocks).
- Grouped lists (`.grouped`) instead of card grids; hairline separators; radius grows with surface size.
- Translucent header (`.material-bar`) falls back to solid under `prefers-reduced-transparency`; overlays become
  cross-fades under `prefers-reduced-motion`; buttons scale to 0.97 on press and grow to 44 px on coarse pointers.
- Canvas is `surface`; cards (`.panel`, `.grouped`) are `surface-raised` with a light-mode-only hairline shadow.
- Charts are hand-built SVG/HTML in `src/components/charts/` (no chart library). One series uses the `chart`
  token (`#2F6BC4` light, `#5A92DC` dark), validated with the dataviz palette script (lightness band, chroma floor,
  ≥3:1 vs card surface); `primary` was too low-chroma for a data mark. Text never takes the series colour; every
  chart has a hover/focus tooltip and an sr-only table. Metrics live in `src/viewmodels/metrics.ts` (tested).
- Sheets and dialogs that represent a URL state (`?reserva=`, `?nuevo=1`) are driven by the route query.

## Platform adaptations
Implemented: native stack navigation (Expo Router `Stack`) → iOS swipe-back and Android hardware/system back both
pop the stack; minimal back-button label; system font; status bar follows scheme.
Planned: Android `android_ripple` press feedback; sheets for secondary flows. One brand, platform-native navigation;
no experimental native UI used purely for appearance. Customer/staff copy is Spanish (es-MX); technical identifiers stay English.

## Mobile client visual language (2026-11-05, revised)
Branding is **not decided**: `brand.json` ("Neutral") is a placeholder palette. Screens only use semantic tokens, so the
final brand is a `brand.json` change + rebuild (plus `public/index.html` theme-color, the static web shell).
- **No gradients** (owner decision). Solid token colors only.
- **Structure:** role-aware tabs (customer: Inicio · Reservas · Cuenta; staff: Servicios · Ganancias · Cuenta) in a
  floating rounded tab bar with a `primary-soft` active pill (`useTabScreenOptions` in `src/navigation.tsx`).
- **Hero header:** every root screen opens on a solid `primary` header with rounded bottom (`HeroPage`/`Hero`), and the
  first card overlaps its edge. The only decoration is the soap-bubble motif (`Bubbles`), drawn in `on-primary` alpha.
- **Surfaces:** raised cards (`Card`, `radius.xl`, `elevation` tokens via `shadow()` in `src/theme.ts`) on `surface`.
- **Color accents:** items and people get a stable tone (`toneFor`) from primary/accent/success/warning `-soft` tokens:
  service tiles (`IconTile`), monogram avatars (until profile photos exist), status badges (`BOOKING_TONES`).
- **Customer home:** next visit card, horizontal service tiles (selection carries into booking), team cards.
- **Booking:** colored flow header with back button, four step cards (service → day → time → address), day tiles,
  3-column time grid, raised bottom bar with total; confirmation as a perforated ticket; success screen after payment.
- **Staff:** hero with counts, "Siguiente servicio" card with full-width check-in button, agenda cards; earnings shows
  the week total in the hero and Generado → Aprobado → Pagado stages.
- **Production layer (2026-11-06):** welcome carousel (3 slides, token-drawn illustrations in `src/illustrations.tsx`,
  shown once via `src/prefs`), cleaner profile (`/(customer)/staff/[id]`: facts, services, real open slots that deep-link
  into booking), booking detail (`/(customer)/booking/[id]`) and staff job detail (`/(staff)/job/[id]`) with a status
  timeline (`StatusTimeline`), "Cómo llegar" (device maps), next open slot per cleaner on the home cards
  (`useNextSlots`), skeleton loading (`SkeletonCards`) instead of spinners.
- **Motion (`src/motion.tsx`, Reanimated 4):** press feedback on touch-down with a critically damped spring release
  (`PressableScale`), one staggered entrance per screen (`Rise`), compact header fading in as the hero scrolls away
  (`HeroPage`), spring-in success check. Reanimated honors the OS reduced-motion setting; skeletons stay static.
- **Copy rule:** only facts the product has confirmed (Mon–Fri, company staff, customer supplies products); no ratings,
  earnings estimates or features the API does not back.
- **Icons:** own 24×24 stroke set in `src/icons.tsx` (react-native-svg); decorative, the control carries the label.
- **Web target:** `public/index.html` adds `viewport-fit=cover`, `theme-color`, no tap highlight, no overscroll chaining,
  `touch-action: manipulation` and 17 px inputs (no iOS zoom). Wide viewports keep a 480 px phone column.
- **Dark mode (pending):** the NativeWind preset is light-only, so the mobile UI is light until the preset emits
  per-scheme values; `src/theme.ts` exposes the light palette for non-class APIs.

## Design skills available to agents (checked 2026-11-03)
`apple-design` (web-oriented Apple motion/interaction guidance), `ui-ux-pro-max`, `emil-design-eng`, `animate-expo`
are installed as Claude Code skills. There is no official Apple-provided "Apple Design" skill; HIG compliance is
reviewed manually against https://developer.apple.com/design/human-interface-guidelines/.
