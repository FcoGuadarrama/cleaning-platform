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

## Platform adaptations
Implemented: native stack navigation (Expo Router `Stack`) → iOS swipe-back and Android hardware/system back both
pop the stack; minimal back-button label; system font; status bar follows scheme.
Planned: Android `android_ripple` press feedback; sheets for secondary flows. One brand, platform-native navigation;
no experimental native UI used purely for appearance. Customer/staff copy is Spanish (es-MX); technical identifiers stay English.

## Mobile client visual language (2026-11-05)
- **Structure:** role-aware bottom tabs (customer: Personal · Reservas · Cuenta; staff: Servicios · Ganancias · Cuenta).
  Tab roots use an iOS-style large title (`Page` in `src/ui.tsx`); pushed flows (`book`) use the native stack header.
- **Surfaces:** `surface` is the screen background; content sits in inset grouped containers (`Group` + `Row`,
  `surface-raised`, `radius.lg`, hairline dividers) instead of one shadowed card per item. One emphasised surface per
  screen at most (staff "Siguiente servicio" on `primary`, earnings summary).
- **People first:** cleaners are shown with monogram avatars (`Avatar`, `primary-soft`) until profile photos exist.
- **Booking:** numbered steps (Servicio → Día → Hora → Dirección) because it is a real sequence; calendar day tiles,
  a 3-column equal-width time grid and a fixed bottom summary bar with total + CTA.
- **Status:** `Badge` tones map booking states (`BOOKING_TONES` in `src/format.ts`) to the `*-soft` tokens.
- **Icons:** own 24×24 stroke set in `src/icons.tsx` (react-native-svg); decorative, the control carries the label.
- **Web target:** `public/index.html` adds `viewport-fit=cover`, `theme-color`, no tap highlight, no overscroll chaining,
  `touch-action: manipulation` and 17 px inputs (no iOS zoom). Wide viewports keep a 480 px phone column.
- **Dark mode (pending):** the NativeWind preset is light-only, so the mobile UI is light until the preset emits
  per-scheme values; `src/theme.ts` exposes the light palette for non-class APIs.

## Design skills available to agents (checked 2026-11-03)
`apple-design` (web-oriented Apple motion/interaction guidance), `ui-ux-pro-max`, `emil-design-eng`, `animate-expo`
are installed as Claude Code skills. There is no official Apple-provided "Apple Design" skill; HIG compliance is
reviewed manually against https://developer.apple.com/design/human-interface-guidelines/.
