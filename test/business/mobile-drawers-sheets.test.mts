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

/** Returns the stylesheet segment beginning at the shared mobile drawer breakpoint. */
function mobileRules(css: string) {
  const marker = "@media (max-width: 600px)";
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, "drawer styles must define the 600px mobile breakpoint");
  return css.slice(start);
}

/** Extracts only one selector's declaration body so later CSS rules cannot satisfy assertions. */
function ruleBody(css: string, selector: string) {
  const ruleStart = css.indexOf(`${selector} {`);
  assert.notEqual(ruleStart, -1, `missing ${selector} rule`);

  const bodyStart = css.indexOf("{", ruleStart) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  assert.notEqual(bodyEnd, -1, `unterminated ${selector} rule`);

  return css.slice(bodyStart, bodyEnd);
}

test("N65 turns every drawer style family into a full-screen mobile sheet", () => {
  for (const path of drawerStylePaths) {
    const css = mobileRules(readFileSync(path, "utf8"));
    const drawer = ruleBody(css, ".drawer");

    assert.match(drawer, /width:\s*100vw;/, path);
    assert.match(drawer, /height:\s*100dvh;/, path);
    assert.match(drawer, /inset:\s*0;/, path);
    assert.match(drawer, /box-shadow:\s*none;/, path);
    assert.match(drawer, /overflow:\s*hidden;/, path);
  }
});

test("N65 keeps Data Sources content scrolling inside the full-screen sheet", () => {
  const css = readFileSync(
    "src/app/(app)/businesses/[businessId]/customers/customer-data-sources-drawer.module.css",
    "utf8",
  );
  const drawerShell = ruleBody(css, ".drawerShell");
  const workflowList = ruleBody(css, ".workflowList");

  assert.match(drawerShell, /height:\s*100%;/);
  assert.match(drawerShell, /min-height:\s*0;/);
  assert.match(workflowList, /flex:\s*1 1 auto;/);
  assert.match(workflowList, /overflow-y:\s*auto;/);
  assert.match(workflowList, /overscroll-behavior:\s*contain;/);
});
