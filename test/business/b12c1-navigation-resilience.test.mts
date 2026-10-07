import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBusinessSetupHref,
  parseBusinessSetupMonthContext,
  parseBusinessSetupStep,
} from "../../src/lib/business/setup-navigation.ts";

test("B12C.1 copied setup URLs remain deterministic for every wizard step", () => {
  const businessId = "123e4567-e89b-42d3-a456-426614174000";
  for (const step of ["business", "revenue", "expenses", "month"] as const) {
    const href = buildBusinessSetupHref(businessId, step, { monthKey: "2026-09" });
    const url = new URL(href, "https://mizan.test");

    assert.deepEqual(parseBusinessSetupStep(url.searchParams.get("step") ?? undefined), {
      kind: "valid",
      step,
    });
    assert.equal(parseBusinessSetupMonthContext(url.searchParams.get("month") ?? undefined), "2026-09");
    assert.equal(url.pathname, `/businesses/${businessId}/setup`);
  }
});

test("B12C.1 setup hrefs preserve only valid month context", () => {
  assert.equal(
    buildBusinessSetupHref("business/01", "expenses", { monthKey: "2026-09" }),
    "/businesses/business%2F01/setup?step=expenses&month=2026-09",
  );
  assert.equal(
    buildBusinessSetupHref("business/01", "expenses", { monthKey: "not-a-month" }),
    "/businesses/business%2F01/setup?step=expenses",
  );
  assert.equal(parseBusinessSetupMonthContext(["2026-08", "2026-09"]), null);
});

const setupPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
  "utf8",
);

test("B12C.1 invalid setup steps canonicalize without dropping valid month context", () => {
  assert.match(
    setupPageSource,
    /parsedStep\.kind === "invalid"[\s\S]*buildBusinessSetupHref\(businessId, undefined, \{ monthKey: navigationMonthKey \}\)/,
  );
});

const e2eSource = await readFile(
  new URL("../../e2e/business-setup.spec.ts", import.meta.url),
  "utf8",
);

test("B12C.1 browser contract covers refresh, Back, Forward, direct URL and RTL stability", () => {
  assert.match(e2eSource, /preserves copied deep URLs through refresh, Back, and Forward/);
  assert.match(e2eSource, /await page\.reload\(\)/);
  assert.match(e2eSource, /await page\.goBack\(\)/);
  assert.match(e2eSource, /await page\.goForward\(\)/);
  assert.match(e2eSource, /await expectStableRtl\(page\)/);
});
