# Design system

## Tokens (`@repo/design-tokens`)
One canonical file: `packages/design-tokens/src/brand.json`, validated by `brand.schema.json` (Ajv) and by a WCAG
contrast check over the pairs listed in `contrast` (build fails below 4.5:1). `pnpm --filter @repo/design-tokens build`
generates (never hand-edit):

| Output | Consumer |
|---|---|
| `dist/tokens.css` | CSS custom properties, light + `prefers-color-scheme: dark` |
| `dist/tailwind-theme.css` | Tailwind 4 `@theme` for the dashboard |
| `dist/<surface>.css` | per-surface palette overrides from `surfaces` (today `dashboard.css`), light + dark, plus `@theme` for colors the base lacks |
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
- **Dashboard palette (2026-11-10, owner: "no verde")**: `brand.json › surfaces.dashboard` overrides the Brisa colors for
  the web panel only (mobile keeps Brisa). Neutral graphite canvas (`surface` #F3F4F6 / #111318), white/raised cards,
  cobalt `primary` (#2D46C8 light, #8FA2FF dark), green only as `success`. The sidebar is dark graphite in both modes
  (`sidebar`, `on-sidebar`, `sidebar-muted`, `sidebar-active`); its own contrast pairs are checked at build, and every
  base pair is re-checked against the merged surface palette.
- **Theme switch**: header menu (`ThemeMenu.vue`) with Claro / Oscuro / Sistema, stored per browser in `localStorage`
  (`dashboard.theme`, `src/theme.ts`). Generated tokens read `<html data-theme>`; without it they follow
  `prefers-color-scheme`. Tailwind `dark:` is a custom variant over the same rule; `index.html` applies the saved theme
  before paint.
- Status colour comes from `BOOKING_STATUS` tones in `src/viewmodels/format.ts` (`StatusBadge`, agenda blocks).
- Grouped lists (`.grouped`) instead of card grids; hairline separators; radius grows with surface size.
- Translucent header (`.material-bar`) falls back to solid under `prefers-reduced-transparency`; overlays become
  cross-fades under `prefers-reduced-motion`; buttons scale to 0.97 on press and grow to 44 px on coarse pointers.
- Canvas is `surface`; cards (`.panel`, `.grouped`) are `surface-raised` with a light-mode-only hairline shadow.
- Charts are hand-built SVG/HTML in `src/components/charts/` (no chart library). One series uses the `chart`
  token (dashboard surface: `#2F6BC4` light, `#5A92DC` dark), validated with the dataviz palette script (lightness band, chroma floor,
  ≥3:1 vs card surface); `primary` was too low-chroma for a data mark. Text never takes the series colour; every
  chart has a hover/focus tooltip and an sr-only table. Metrics live in `src/viewmodels/metrics.ts` (tested).
- Sheets and dialogs that represent a URL state (`?reserva=`, `?nuevo=1`) are driven by the route query.

## Platform adaptations
Implemented: native stack navigation (Expo Router `Stack`) → iOS swipe-back and Android hardware/system back both
pop the stack; minimal back-button label; system font; status bar follows scheme.
Planned: Android `android_ripple` press feedback; sheets for secondary flows. One brand, platform-native navigation;
no experimental native UI used purely for appearance. Customer/staff copy is Spanish (es-MX); technical identifiers stay English.

## Mobile client visual language: "brisa" (2026-11-06, replaces the 2026-11-05 design)
The owner supplied a "brisa" product concept (6 customer screens) and asked for it 1:1. `brand.json` is now **Brisa**:
teal `primary` (#0B5E67), aqua `primary-soft` (#D8F4F3) for date blocks, day tiles, avatars and callouts, mint
`accent`, white `background`, and typography **Outfit** (`@expo-google-fonts/outfit`, loaded in `src/fonts.ts`).
Screens use semantic tokens only; the token change also restyles the web dashboard.
- **No gradients, no shadows.** Flat white pages; cards have a 1 px `border`; lists are rows separated by hairlines
  (`List`/`Row` in `src/ui.tsx`).
- **Type:** `font-*` classes select a font family per weight (`tailwind.config.js` disables the numeric fontWeight
  plugin; `src/font-families.cjs`). Use `Text` from `src/text.tsx` (regular by default), not React Native's `Text`.
  Large titles are `text-2xl font-bold tracking-[-1px]`, kickers are `Overline` (uppercase, wide tracking).
- **Structure:** flat white tab bar under a hairline (customer: Inicio · Visitas · Cuenta; staff: Servicios ·
  Ganancias · Cuenta); root screens use `Screen` and pushed screens use `FlowScreen` (back chevron + title, optional
  pinned footer) from `src/screen.tsx`.
- **Customer screens:** Inicio (wordmark, default saved address linking to Mis domicilios, "Tu {día}, con más tiempo.", interior image,
  next-visit card, services list); Visitas (month kicker, week arrows, Próximas/Historial underline tabs, week strip
  with visit dots, visit card with 24 h time range); Cuenta (grouped rows: Tu hogar / Pagos y plan / Ayuda); Mis domicilios (hairline list with a "Principal"
  tag, add/edit form, inline delete confirmation in danger tones);
  Reservar in 3 steps (profesional → fecha y hora → "Revisa tu reserva", which is the designed screen; the default address is preselected and "Cambiar" opens the
  saved addresses with check marks plus "Agregar domicilio") with sandbox
  payment; Detalle de visita (status chip, big time, cleaner row, indicaciones, prepara tu visita). Staff screens and
  sign-in use the same pieces.
- **Not supported yet → "Próximamente":** designed features without backend are visible but cannot be tapped
  (`Soon`, the `soon` prop on `Row`/`Button`/`TextLink`). The full list, with the RFC/ADR each one needs, is in
  `docs/rfc/brisa-feature-gaps.md`. Screen 05 (plan mensual) is not built.
- **Placeholders:** interior photography → `HomeScene` (token-drawn, `src/illustrations.tsx`); people photos → initials
  `Avatar`; the logo → `Wordmark` set in Outfit until `assets.logo` exists.
- **Copy rule:** only confirmed facts and rules (Mon–Fri, company staff, customer supplies products, 24 h change
  notice). The concept's sample values (prices, kit +$80, "4 visitas") are not used.
- **Motion:** press feedback (`PressableScale`), one entrance per primary card (`Rise`), spring-in success check;
  Reanimated honors reduced motion.
- **Web target:** `public/index.html` theme-color = `background` (white tops), 17 px inputs, no tap highlight; wide
  viewports keep a 480 px column.
- **Dark mode (pending):** the NativeWind preset is light-only; `src/theme.ts` exposes the light palette.

## Design skills available to agents (checked 2026-11-03)
`apple-design` (web-oriented Apple motion/interaction guidance), `ui-ux-pro-max`, `emil-design-eng`, `animate-expo`
are installed as Claude Code skills. There is no official Apple-provided "Apple Design" skill; HIG compliance is
reviewed manually against https://developer.apple.com/design/human-interface-guidelines/.
