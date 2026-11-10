import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "build.mjs");
const brand = JSON.parse(readFileSync(join(here, "../src/brand.json"), "utf8"));

function run(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "tokens-"));
  const copy = structuredClone(brand);
  mutate(copy);
  writeFileSync(join(dir, "brand.json"), JSON.stringify(copy));
  return { dir, result: spawnSync(process.execPath, [build, join(dir, "brand.json"), join(dir, "dist")], { encoding: "utf8" }) };
}

test("generation is deterministic", () => {
  const a = run(() => {});
  const b = run(() => {});
  assert.equal(a.result.status, 0, a.result.stderr);
  for (const f of ["tokens.css", "tailwind-theme.css", "dashboard.css", "native.js", "nativewind-preset.cjs"]) {
    assert.equal(readFileSync(join(a.dir, "dist", f), "utf8"), readFileSync(join(b.dir, "dist", f), "utf8"));
  }
});

test("changing the brand JSON changes generated themes", () => {
  const { dir } = run((b) => { b.color.light.primary = "#1F4E79"; });
  assert.match(readFileSync(join(dir, "dist/tokens.css"), "utf8"), /--color-primary: #1F4E79/);
  assert.match(readFileSync(join(dir, "dist/nativewind-preset.cjs"), "utf8"), /#1F4E79/);
});

test("fails on insufficient contrast", () => {
  const { result } = run((b) => { b.color.light["text-muted"] = "#C7C7CC"; });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /text-muted on background/);
});

test("surface overrides are emitted and contrast-checked", () => {
  const ok = run((b) => { b.surfaces.dashboard.light.primary = "#1F4E79"; });
  assert.equal(ok.result.status, 0, ok.result.stderr);
  const css = readFileSync(join(ok.dir, "dist/dashboard.css"), "utf8");
  assert.match(css, /--color-primary: #1F4E79/);
  assert.match(css, /@theme inline \{\n  --color-sidebar: var\(--color-sidebar\);/);
  const bad = run((b) => { b.surfaces.dashboard.dark["sidebar-muted"] = "#30343C"; });
  assert.equal(bad.result.status, 1);
  assert.match(bad.result.stderr, /dashboard dark: sidebar-muted on sidebar/);
});

test("fails on schema violations", () => {
  const { result } = run((b) => { b.color.light.primary = "blue"; });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /schema/);
});

test("committed dist matches source", () => {
  execFileSync(process.execPath, [build]);
});
