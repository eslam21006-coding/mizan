import assert from "node:assert/strict";
import test from "node:test";
import {
  redirectHistoricalCorrection,
  redirectHistoricalCorrectionSuccess,
} from "../../src/lib/historical-correction-navigation.ts";
import { resolveHistoricalMonthlyUiState } from "../../src/lib/historical-month-state.ts";

class RedirectCapture extends Error {
  location: string;

  constructor(location: string) {
    super(location);
    this.location = location;
  }
}

function captureNavigation(run: (effects: {
  revalidatePath: (path: string) => void;
  redirect: (path: string) => never;
}) => never) {
  const revalidated: string[] = [];
  let redirectedTo: string | null = null;

  try {
    run({
      revalidatePath(path) {
        revalidated.push(path);
      },
      redirect(path) {
        redirectedTo = path;
        throw new RedirectCapture(path);
      },
    });
  } catch (error) {
    if (!(error instanceof RedirectCapture)) throw error;
  }

  return { revalidated, redirectedTo };
}

test("N34 returns successful historical corrections to the exact Monthly month", () => {
  const navigation = captureNavigation((effects) =>
    redirectHistoricalCorrectionSuccess(effects, "business / one", "2026-07"),
  );

  assert.deepEqual(navigation.revalidated, [
    "/businesses/business%20%2F%20one/monthly",
    "/businesses/business%20%2F%20one/monthly/correction",
    "/businesses/business%20%2F%20one/customers",
    "/businesses/business%20%2F%20one/customers/review",
  ]);
  assert.ok(navigation.redirectedTo);

  const successUrl = new URL(navigation.redirectedTo, "https://mizan.test");
  assert.equal(successUrl.pathname, "/businesses/business%20%2F%20one/monthly");
  assert.equal(successUrl.searchParams.get("month"), "2026-07");
  assert.equal(successUrl.searchParams.get("status"), "corrected");
  assert.equal([...successUrl.searchParams.keys()].length, 2);
});

test("N34 keeps correction failures inside the exact correction workflow", () => {
  const navigation = captureNavigation((effects) =>
    redirectHistoricalCorrection(
      effects,
      "business / one",
      "2026-07",
      "correction-failed",
    ),
  );

  assert.ok(navigation.redirectedTo);
  const failureUrl = new URL(navigation.redirectedTo, "https://mizan.test");
  assert.equal(
    failureUrl.pathname,
    "/businesses/business%20%2F%20one/monthly/correction",
  );
  assert.equal(failureUrl.searchParams.get("month"), "2026-07");
  assert.equal(failureUrl.searchParams.get("status"), "correction-failed");
});

test("N34 shows correction success only for a saved historical month", () => {
  const savedHistorical = resolveHistoricalMonthlyUiState({
    status: "corrected",
    isHistorical: true,
    hasSavedPeriod: true,
    canManage: true,
    dataLoadError: false,
  });
  assert.equal(savedHistorical.showCorrectionSuccess, true);
  assert.equal(savedHistorical.isSavedHistorical, true);
  assert.equal(savedHistorical.canEditMonth, false);

  for (const state of [
    resolveHistoricalMonthlyUiState({
      status: "corrected",
      isHistorical: false,
      hasSavedPeriod: true,
      canManage: true,
      dataLoadError: false,
    }),
    resolveHistoricalMonthlyUiState({
      status: "corrected",
      isHistorical: true,
      hasSavedPeriod: false,
      canManage: true,
      dataLoadError: false,
    }),
    resolveHistoricalMonthlyUiState({
      status: "saved",
      isHistorical: true,
      hasSavedPeriod: true,
      canManage: true,
      dataLoadError: false,
    }),
  ]) {
    assert.equal(state.showCorrectionSuccess, false);
  }
});

test("N34 keeps a saved historical month read-only after a successful correction", () => {
  const state = resolveHistoricalMonthlyUiState({
    status: "corrected",
    isHistorical: true,
    hasSavedPeriod: true,
    canManage: true,
    dataLoadError: false,
  });

  assert.equal(state.isSavedHistorical, true);
  assert.equal(state.canEditMonth, false);
});
