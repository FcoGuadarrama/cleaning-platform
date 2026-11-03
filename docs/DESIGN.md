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
pop the stack; minimal back-button label; system font; `min-h-11` (44 pt) pressables; status bar follows scheme.
Planned (Sprint 2 UI pass): iOS large titles on root screens and sheets for secondary flows; Android
`android_ripple` press feedback. One brand, platform-native navigation; no experimental native UI used purely
for appearance. Customer/staff copy is Spanish (es-MX); technical identifiers stay English.

## Design skills available to agents (checked 2026-11-03)
`apple-design` (web-oriented Apple motion/interaction guidance), `ui-ux-pro-max`, `emil-design-eng`, `animate-expo`
are installed as Claude Code skills. There is no official Apple-provided "Apple Design" skill; HIG compliance is
reviewed manually against https://developer.apple.com/design/human-interface-guidelines/.
