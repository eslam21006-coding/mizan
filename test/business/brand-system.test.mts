import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("locks the approved Mizan palette and preserves a separate danger color", () => {
  const theme = read("src/app/brand-theme.css");
  const globals = read("src/app/globals.css");

  assert.match(theme, /--bg:\s*#f7f8f5/i);
  assert.match(theme, /--text:\s*#20292e/i);
  assert.match(theme, /--brand:\s*#17313c/i);
  assert.match(theme, /--accent:\s*#27b5a5/i);
  assert.match(globals, /--danger:\s*#9f3b3b/i);
});

test("uses the new abstract balance mark instead of the former justice-scale icon", () => {
  const brand = read("src/components/brand.tsx");

  assert.match(brand, /mizan-mark-left/);
  assert.match(brand, /mizan-mark-dot/);
  assert.match(brand, /mizan-mark-right/);
  assert.doesNotMatch(brand, /M10 9l-4 7h8l-4-7/);
});

test("ships the branded favicon and wires the theme after the base stylesheet", () => {
  const icon = read("src/app/icon.svg");
  const layout = read("src/app/layout.tsx");
  const globalsIndex = layout.indexOf('import "./globals.css";');
  const themeIndex = layout.indexOf('import "./brand-theme.css";');

  assert.match(icon, /fill="#17313C"/);
  assert.match(icon, /fill="#27B5A5"/);
  assert.ok(globalsIndex >= 0);
  assert.ok(themeIndex > globalsIndex);
  assert.match(layout, /themeColor:\s*"#f7f8f5"/i);
});
