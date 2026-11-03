/** Theme values come only from @repo/design-tokens (generated from brand.json). */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), require("@repo/design-tokens/nativewind-preset")],
};
