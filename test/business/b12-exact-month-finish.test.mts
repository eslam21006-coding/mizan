import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveSetupMonthPrimaryAction } from "../../src/lib/business/setup-month-action.ts";

const businessId = "123e4567-e89b-42d3-a456-426614174000";

test("B12A.3 disables Finish when the selected month itself is not complete", () => {
  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "month_incomplete",
      selectedMonthLoaded: true,
      selectedMonthComplete: false,
      resumeStep: null,
    }),
    { enabled: false, href: null, label: "إنهاء الإعداد" },
  );

  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "not_saved",
      selectedMonthLoaded: true,
      selectedMonthComplete: false,
      resumeStep: null,
    }),
    { enabled: false, href: null, label: "إنهاء الإعداد" },
  );
});

test("B12A.3 read failure or future-month gate never enables Finish", () => {
  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "ready",
      selectedMonthLoaded: false,
      selectedMonthComplete: false,
      resumeStep: null,
    }),
    { enabled: false, href: null, label: "إنهاء الإعداد" },
  );

  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-11",
      gateKind: "future_month",
      selectedMonthLoaded: true,
      selectedMonthComplete: true,
      resumeStep: null,
    }),
    { enabled: false, href: null, label: "إنهاء الإعداد" },
  );
});

test("B12A.3 exact ready month points Finish only to the exact independently verified payoff route", () => {
  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "ready",
      selectedMonthLoaded: true,
      selectedMonthComplete: true,
      resumeStep: null,
    }),
    {
      enabled: true,
      href: `/businesses/${businessId}/setup/result?month=2026-10`,
      label: "إنهاء الإعداد",
    },
  );
});

test("B12A.3 a complete selected month with another setup gap goes directly to the first missing step", () => {
  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "setup_incomplete",
      selectedMonthLoaded: true,
      selectedMonthComplete: true,
      resumeStep: "expenses",
    }),
    {
      enabled: true,
      href: `/businesses/${businessId}/setup?step=expenses&month=2026-10`,
      label: "أكمل الإعداد",
    },
  );

  assert.deepEqual(
    resolveSetupMonthPrimaryAction({
      businessId,
      monthKey: "2026-10",
      gateKind: "setup_incomplete",
      selectedMonthLoaded: true,
      selectedMonthComplete: true,
      resumeStep: "month",
    }),
    { enabled: false, href: null, label: "إنهاء الإعداد" },
  );
});

test("B12A.3 production Step 4 reuses the B11 gate and result route independently verifies again", async () => {
  const setupPage = await readFile(
    new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
    "utf8",
  );
  const resultPage = await readFile(
    new URL("../../src/app/(app)/businesses/[businessId]/setup/result/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(setupPage, /resolvePayoffMonthGate\(loadResult, monthSelection\.monthKey\)/);
  assert.match(setupPage, /resolveSetupMonthPrimaryAction\(/);
  assert.match(setupPage, /firstMonth\.hasSavedPeriod/);
  assert.match(setupPage, /firstMonth\.completeness\?\.complete === true/);
  assert.match(resultPage, /loadAuthenticatedSetupPayoff\(businessId, query\.month\)/);
});
