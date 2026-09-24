import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const drawerStylePaths = [
  "src/app/(app)/businesses/[businessId]/customers/customer-data-sources-drawer.module.css",
  "src/app/(app)/businesses/[businessId]/customers/customer-detail-drawer.module.css",
  "src/app/(app)/businesses/[businessId]/expenses/expense-drawer.module.css",
  "src/app/(app)/businesses/[businessId]/funnels/funnel-create-drawer.module.css",
  "src/app/(app)/businesses/[businessId]/revenue-streams/revenue-stream-drawer.module.css",
  "src/components/dashboard-metric-drawer.module.css",
];

function mobileRules(css: string) {
  const marker = "@media (max-width: 600px)";
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, "drawer styles must define the 600px mobile breakpoint");
  return css.slice(start);
}

test("N65 turns every drawer style family into a full-screen mobile sheet", () => {
  for (const path of drawerStylePaths) {
    const css = mobileRules(readFileSync(path, "utf8"));
    assert.match(css, /\.drawer\s*\{[\s\S]*?width:\s*100vw;/, path);
    assert.match(css, /\.drawer\s*\{[\s\S]*?height:\s*100dvh;/, path);
    assert.match(css, /\.drawer\s*\{[\s\S]*?inset:\s*0;/, path);
    assert.match(css, /\.drawer\s*\{[\s\S]*?box-shadow:\s*none;/, path);
    assert.match(css, /\.drawer\s*\{[\s\S]*?overflow:\s*hidden;/, path);
  }
});

test("N65 keeps Data Sources content scrolling inside the full-screen sheet", () => {
  const css = readFileSync(
    "src/app/(app)/businesses/[businessId]/customers/customer-data-sources-drawer.module.css",
    "utf8",
  );
  assert.match(css, /\.drawerShell\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
  assert.match(css, /\.workflowList\s*\{[\s\S]*?flex:\s*1 1 auto;/);
  assert.match(css, /\.workflowList\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(css, /\.workflowList\s*\{[\s\S]*?overscroll-behavior:\s*contain;/);
});
