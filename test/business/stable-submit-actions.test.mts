import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stableButtonSource = readFileSync("src/components/stable-submit-button.tsx", "utf8");
const stableButtonStyles = readFileSync("src/components/stable-submit-button.module.css", "utf8");

const auditedSources = [
  "src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx",
  "src/app/(app)/businesses/[businessId]/revenue-streams/revenue-stream-drawer.tsx",
  "src/app/(app)/businesses/[businessId]/funnels/funnel-create-drawer.tsx",
  "src/app/(app)/businesses/[businessId]/funnels/funnel-edit-drawer.tsx",
  "src/app/(app)/settings/businesses/[businessId]/delete/business-delete-form.tsx",
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
].map((path) => readFileSync(path, "utf8"));

test("N61 shared submit control exposes pending state without resizing its label box", () => {
  assert.match(stableButtonSource, /useFormStatus/);
  assert.match(stableButtonSource, /disabled={isDisabled}/);
  assert.match(stableButtonSource, /aria-busy={pending \|\| undefined}/);
  assert.match(stableButtonSource, /pendingLabel/);
  assert.match(stableButtonSource, /role="status"/);
  assert.match(stableButtonSource, /aria-atomic="true"/);
  assert.match(stableButtonSource, /pending \? pendingLabel : null/);
  assert.match(stableButtonStyles, /display: inline-grid/);
  assert.match(stableButtonStyles, /max-width: 100%/);
  assert.match(stableButtonStyles, /grid-area: 1 \/ 1/);
  assert.match(stableButtonStyles, /white-space: normal/);
  assert.match(stableButtonStyles, /overflow-wrap: anywhere/);
  assert.match(stableButtonStyles, /visibility: hidden/);
});

test("N61 applies stable pending submits to the audited destructive and save actions", () => {
  for (const source of auditedSources) {
    assert.match(source, /StableSubmitButton/);
  }

  const monthlySource = auditedSources.at(-1) ?? "";
  assert.match(monthlySource, /جارٍ نسخ المصروفات/);
  assert.match(monthlySource, /جارٍ حفظ الشهر/);

  const deleteSource = auditedSources.at(-2) ?? "";
  assert.match(deleteSource, /disabled={!isConfirmed}/);
  assert.match(deleteSource, /جارٍ حذف البزنس/);
});
