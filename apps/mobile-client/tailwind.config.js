/** Theme values come only from @repo/design-tokens (generated from brand.json). */
const { FONT_FAMILIES } = require("./src/font-families.cjs");

module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), require("@repo/design-tokens/nativewind-preset")],
  // Custom fonts ship one file per weight, so `font-bold` etc. select a font family instead of a numeric weight
  // (a numeric weight on a custom family makes Android synthesize bold).
  corePlugins: { fontWeight: false },
  theme: { extend: { fontFamily: Object.fromEntries(Object.entries(FONT_FAMILIES).map(([k, v]) => [k, [v]])) } },
};
