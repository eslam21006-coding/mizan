import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveHistoricalMonthlyUiState } from "../../src/lib/historical-month-state.ts";

const correctionPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/page.tsx",
  "utf8",
);
const correctionNavigationSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-navigation.tsx",
  "utf8",
);
const correctionFormSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-form.tsx",
  "utf8",
);
const historicalMonthStateSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/historical-month-state.tsx",
  "utf8",
);

test("N32 treats only already-saved past months as historical read-only state", () => {
  const savedPast = resolveHistoricalMonthlyUiState({
    isHistorical: true,
    hasSavedPeriod: true,
    canManage: true,
    dataLoadError: false,
  });
  assert.equal(savedPast.isSavedHistorical, true);
  assert.equal(savedPast.canEditMonth, false);

  const unsavedPast = resolveHistoricalMonthlyUiState({
    isHistorical: true,
    hasSavedPeriod: false,
    canManage: true,
    dataLoadError: false,
  });
  assert.equal(unsavedPast.isSavedHistorical, false);
  assert.equal(unsavedPast.canEditMonth, true);

  const currentSaved = resolveHistoricalMonthlyUiState({
    isHistorical: false,
    hasSavedPeriod: true,
    canManage: true,
    dataLoadError: false,
  });
  assert.equal(currentSaved.isSavedHistorical, false);
  assert.equal(currentSaved.canEditMonth, true);

});

test("N33 correction navigation returns to the exact historical Monthly month", () => {
  assert.match(
    historicalMonthStateSource,
    /function HistoricalMonthState[\s\S]*const correctionHref = buildHistoricalCorrectionPath\(/,
  );
  assert.doesNotMatch(historicalMonthStateSource, /new URLSearchParams/);
  assert.match(correctionPageSource, /<HistoricalCorrectionNavigation/);
  assert.match(correctionNavigationSource, /<Breadcrumb items=\{breadcrumbItems\}/);
  assert.match(correctionNavigationSource, /route: "business-monthly" as const/);
  assert.match(correctionNavigationSource, /month: monthKey/);
  assert.match(correctionNavigationSource, /العودة إلى/);
  assert.doesNotMatch(correctionPageSource, /className=\{styles\.backLink\}/);
});

test("N33 keeps correction reason mandatory and the explicit correction save action", () => {
  assert.match(correctionFormSource, /name="correction_reason"/);
  assert.match(correctionFormSource, /maxLength=\{500\}/);
  assert.match(correctionFormSource, /required/);
  assert.match(correctionFormSource, /حفظ التصحيح التاريخي/);
  assert.match(correctionFormSource, /correctHistoricalMonthlyActuals/);
});
