import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  redirectHistoricalCorrection,
  redirectHistoricalCorrectionSuccess,
} from "../../src/lib/historical-correction-navigation.ts";

const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const successSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/historical-correction-success.tsx",
  "utf8",
);

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

test("N34 only shows correction success on a saved historical Monthly month", () => {
  assert.match(
    monthlyPageSource,
    /const isHistoricalCorrectionSuccess = query\.status === "corrected" && isSavedHistorical/,
  );
  assert.match(monthlyPageSource, /<HistoricalCorrectionSuccess monthLabel=\{monthLabel\} \/>/);
  assert.match(successSource, /role="status"/);
  assert.match(successSource, /aria-label="تأكيد التصحيح التاريخي"/);
  assert.match(successSource, /تم حفظ التصحيح التاريخي/);
  assert.match(successSource, /سبب التصحيح ونسخة قبل وبعد/);
  assert.match(successSource, /العرض\s+التاريخي للشهر/);
});
