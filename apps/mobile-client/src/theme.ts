import { tokens } from "@repo/design-tokens/native";

/**
 * Raw token values for APIs that cannot take classes (SVG fills, navigator options).
 * Light palette only: the NativeWind preset is light-only until dark mode lands for mobile.
 * Every visual here follows brand.json, so the final branding replaces it without touching screens.
 */
export const color = tokens.color.light;

/** Hex color + alpha (0–1) as an 8-digit hex, for translucent fills. */
export const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")}`;
