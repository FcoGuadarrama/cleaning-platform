// Validates src/brand.json and generates deterministic web + native adapters into dist/.
// Fails (exit 1) on schema errors, unknown color references or WCAG AA contrast failures.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brandPath = process.argv[2] ?? join(root, "src/brand.json");
const dist = process.argv[3] ?? join(root, "dist");
const brand = JSON.parse(readFileSync(brandPath, "utf8"));
const schema = JSON.parse(readFileSync(join(root, "src/brand.schema.json"), "utf8"));

const errors = [];
const ajv = new Ajv2020({ allErrors: true });
if (!ajv.validate(schema, brand)) {
  errors.push(...ajv.errors.map((e) => `schema ${e.instancePath} ${e.message}`));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const mode of ["light", "dark"]) {
  const palette = brand.color?.[mode] ?? {};
  for (const [fg, bg] of brand.contrast ?? []) {
    if (!palette[fg] || !palette[bg]) {
      errors.push(`contrast pair ${fg}/${bg} references unknown color in ${mode}`);
      continue;
    }
    const ratio = contrastRatio(palette[fg], palette[bg]);
    if (ratio < 4.5) errors.push(`${mode}: ${fg} on ${bg} = ${ratio.toFixed(2)} < 4.5 (WCAG AA)`);
  }
}
for (const [name, variants] of Object.entries(brand.components ?? {})) {
  for (const [variant, spec] of Object.entries(variants)) {
    for (const key of ["bg", "fg", "border"]) {
      if (spec[key] && !(spec[key] in (brand.color?.light ?? {}))) {
        errors.push(`components.${name}.${variant}.${key} references unknown color "${spec[key]}"`);
      }
    }
  }
}

if (errors.length) {
  console.error(`design-tokens: ${errors.length} error(s)\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

const header = "/* GENERATED from src/brand.json by scripts/build.mjs — do not edit. */\n";
const px = (n) => `${n}px`;
const vars = (palette) =>
  Object.entries(palette)
    .map(([k, v]) => `  --color-${k}: ${v};`)
    .join("\n");
const scale = (prefix, map, unit = px) =>
  Object.entries(map)
    .map(([k, v]) => `  --${prefix}-${k}: ${unit(v)};`)
    .join("\n");
const shadows = Object.entries(brand.elevation)
  .map(([k, e]) => `  --shadow-${k}: 0 ${e.y}px ${e.blur}px rgb(0 0 0 / ${e.opacity});`)
  .join("\n");

const tokensCss = `${header}:root {
${vars(brand.color.light)}
${scale("text", brand.typography.size)}
${scale("leading", brand.typography.lineHeight)}
${scale("spacing", brand.spacing)}
${scale("radius", brand.radius)}
${shadows}
  --touch-target: ${px(brand.minTouchTarget)};
}
@media (prefers-color-scheme: dark) {
  :root {
${vars(brand.color.dark).replace(/^/gm, "  ")}
  }
}
`;

// Tailwind 4 theme: utilities reference the runtime CSS variables so dark mode follows tokens.css.
const tailwindTheme = `${header}@theme inline {
${Object.keys(brand.color.light)
  .map((k) => `  --color-${k}: var(--color-${k});`)
  .join("\n")}
${Object.keys(brand.radius)
  .map((k) => `  --radius-${k}: var(--radius-${k});`)
  .join("\n")}
${Object.keys(brand.elevation)
  .map((k) => `  --shadow-${k}: var(--shadow-${k});`)
  .join("\n")}
${Object.keys(brand.typography.size)
  .map((k) => `  --text-${k}: var(--text-${k});\n  --text-${k}--line-height: var(--leading-${k});`)
  .join("\n")}
}
`;

const native = {
  name: brand.name,
  version: brand.version,
  color: brand.color,
  typography: brand.typography,
  spacing: brand.spacing,
  radius: brand.radius,
  elevation: brand.elevation,
  minTouchTarget: brand.minTouchTarget,
  components: brand.components,
  assets: brand.assets,
};
const nativeJs = `${header}export const tokens = ${JSON.stringify(native, null, 2)};\nexport default tokens;\n`;
const nativeDts = `${header}export declare const tokens: ${JSON.stringify(native, null, 2).replace(/"([^"]+)":/g, '"$1":')};\nexport default tokens;\n`;

// NativeWind 4 uses Tailwind 3 presets (CommonJS).
const preset = {
  theme: {
    extend: {
      colors: Object.fromEntries(Object.entries(brand.color.light)),
      borderRadius: Object.fromEntries(Object.entries(brand.radius).map(([k, v]) => [k, px(v)])),
      spacing: Object.fromEntries(Object.entries(brand.spacing).map(([k, v]) => [k, px(v)])),
      fontSize: Object.fromEntries(
        Object.entries(brand.typography.size).map(([k, v]) => [
          k,
          [px(v), { lineHeight: px(brand.typography.lineHeight[k]) }],
        ]),
      ),
    },
  },
};
const presetCjs = `${header}module.exports = ${JSON.stringify(preset, null, 2)};\n`;

mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "tokens.css"), tokensCss);
writeFileSync(join(dist, "tailwind-theme.css"), tailwindTheme);
writeFileSync(join(dist, "native.js"), nativeJs);
writeFileSync(join(dist, "native.d.ts"), nativeDts);
writeFileSync(join(dist, "nativewind-preset.cjs"), presetCjs);
console.log("design-tokens: generated dist/ (tokens.css, tailwind-theme.css, native.js, nativewind-preset.cjs)");
