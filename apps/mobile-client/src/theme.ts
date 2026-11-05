import { tokens } from "@repo/design-tokens/native";

/**
 * Raw token values for APIs that cannot take classes (SVG fills, shadows, navigator options).
 * Light palette only: the NativeWind preset is light-only until dark mode lands for mobile.
 * Every visual here follows brand.json, so the final branding replaces it without touching screens.
 */
export const color = tokens.color.light;

type Level = keyof typeof tokens.elevation;

/** Hex color + alpha (0–1) as an 8-digit hex, for tinted shadows and overlays. */
export const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")}`;

/** Elevation token as a cross-platform `boxShadow`; `tint` colors the shadow (e.g. primary buttons). */
export function shadow(level: Level, tint = "#000000") {
  const e = tokens.elevation[level];
  return { boxShadow: `0px ${e.y}px ${e.blur}px ${alpha(tint, e.opacity)}` };
}
