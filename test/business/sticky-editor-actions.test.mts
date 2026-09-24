import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sharedStyles = readFileSync("src/components/mobile-editor-actions.module.css", "utf8");
const monthlyPage = readFileSync("src/app/(app)/businesses/[businessId]/monthly/page.tsx", "utf8");
const correctionForm = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-form.tsx",
  "utf8",
);
const funnelMonthly = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/page.tsx",
  "utf8",
);
const importValidator = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
  "utf8",
);

/** Extracts the N66 mobile breakpoint so desktop behavior cannot satisfy mobile assertions. */
function mobileRules(css: string) {
  const marker = "@media (max-width: 720px)";
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, "N66 shared styles must define the 720px mobile breakpoint");
  return css.slice(start);
}

/** Extracts one CSS rule body without allowing declarations from later selectors to leak in. */
function ruleBody(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const bodyStart = css.indexOf("{", start) + 1;
  const bodyEnd = css.indexOf("}", bodyStart);
  assert.notEqual(bodyEnd, -1, `unterminated ${selector} rule`);
  return css.slice(bodyStart, bodyEnd);
}

test("N66 mobile action bar is fixed, safe-area aware, and reserves editor space", () => {
  const css = mobileRules(sharedStyles);
  const surface = ruleBody(css, ".editorSurface");
  const bar = ruleBody(css, ".actionBar");

  assert.match(surface, /padding-bottom:\s*calc\(116px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(surface, /scroll-padding-bottom:\s*calc\(116px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /scroll-margin-bottom:\s*calc\(116px \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(bar, /position:\s*fixed\s*!important;/);
  assert.match(bar, /bottom:\s*max\(8px, env\(safe-area-inset-bottom\)\)\s*!important;/);
  assert.match(bar, /z-index:\s*40\s*!important;/);
});

test("N66 attaches the shared sticky action primitive to every intended full-page editor", () => {
  for (const [name, source] of [
    ["monthly", monthlyPage],
    ["historical correction", correctionForm],
    ["funnel monthly", funnelMonthly],
    ["transaction import", importValidator],
  ] as const) {
    assert.match(source, /mobileActionStyles\.editorSurface/, name);
    assert.match(source, /mobileActionStyles\.actionBar/, name);
  }
});

test("N66 keeps read-only editor action structure visible without mutation controls", () => {
  assert.match(monthlyPage, /data-editor-action-bar="monthly-read-only"/);
  assert.match(monthlyPage, /"عرض فقط — شهر تاريخي"\s*:\s*"عرض فقط"/);
  assert.match(correctionForm, /data-editor-action-bar="historical-correction-read-only"/);
  assert.match(correctionForm, /<strong>عرض فقط<\/strong>/);
  assert.match(funnelMonthly, /data-editor-action-bar="funnel-monthly-read-only"/);
  assert.match(funnelMonthly, /<strong>عرض فقط<\/strong>/);
});

test("N66 transaction import exposes only the currently relevant sticky primary action", () => {
  assert.match(
    importValidator,
    /pendingCandidates\.length === 0 && !completionSummary[\s\S]*data-editor-action-bar="transaction-import"/,
  );
  assert.match(
    importValidator,
    /pendingCandidates\.length > 0[\s\S]*data-editor-action-bar="transaction-import-candidates"/,
  );
});
