import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildBusinessSetupHref,
  parseBusinessSetupMonthContext,
} from "../../src/lib/business/setup-navigation.ts";

test("B12A.2 parses only one canonical setup month context", () => {
  assert.equal(parseBusinessSetupMonthContext("2026-08"), "2026-08");
  assert.equal(parseBusinessSetupMonthContext(undefined), null);
  assert.equal(parseBusinessSetupMonthContext("2026-8"), null);
  assert.equal(parseBusinessSetupMonthContext("2026-13"), null);
  assert.equal(parseBusinessSetupMonthContext(["2026-08", "2026-09"]), null);
});

test("B12A.2 setup hrefs preserve valid month context and drop invalid context", () => {
  assert.equal(
    buildBusinessSetupHref("business fixture/01", "expenses", { monthKey: "2026-08" }),
    "/businesses/business%20fixture%2F01/setup?step=expenses&month=2026-08",
  );
  assert.equal(
    buildBusinessSetupHref("business fixture/01", "month", { monthKey: "bad" }),
    "/businesses/business%20fixture%2F01/setup?step=month",
  );
  assert.equal(
    buildBusinessSetupHref("business fixture/01", undefined, { monthKey: "2026-08" }),
    "/businesses/business%20fixture%2F01/setup?month=2026-08",
  );
});

test("B12A.2 production route and shell carry only canonical month context", async () => {
  const setupPage = await readFile(
    new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
    "utf8",
  );
  const setupShell = await readFile(
    new URL(
      "../../src/app/(app)/businesses/[businessId]/setup/business-setup-shell.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(setupPage, /parseBusinessSetupMonthContext\(query\.month\)/);
  assert.match(setupPage, /monthKey: navigationMonthKey/);
  assert.match(setupPage, /navigationMonthKey=\{navigationMonthKey\}/);
  assert.match(setupShell, /navigationMonthKey: string \| null/);
  assert.match(setupShell, /buildBusinessSetupHref\(businessId, step, \{/);
});

test("B12A.2 picker cancels pending history synchronization before accepting a user edit", async () => {
  const picker = await readFile(
    new URL(
      "../../src/app/(app)/businesses/[businessId]/setup/first-month-picker.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(picker, /pendingFrameRef/);
  assert.match(picker, /cancelAnimationFrame\(pendingFrameRef\.current\)/);
  assert.match(
    picker,
    /onChange=\{\(event\) => \{[\s\S]*cancelAnimationFrame[\s\S]*setSelectedMonth/,
  );
});
