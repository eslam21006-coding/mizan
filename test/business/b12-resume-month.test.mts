import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  resolveResumableFirstMonthSelection,
  type FirstMonthResumeMonths,
} from "../../src/lib/business/first-month-selection.ts";

const cairoBoundary = new Date("2026-09-30T22:30:00.000Z");

function months(
  savedMonthKeys: readonly string[],
  completedMonthKeys: readonly string[] = [],
): FirstMonthResumeMonths {
  return { savedMonthKeys, completedMonthKeys };
}

test("B12A.1 defaults to the current business month when no saved incomplete month exists", () => {
  assert.deepEqual(
    resolveResumableFirstMonthSelection(undefined, "Africa/Cairo", months([]), cairoBoundary),
    { kind: "default", monthKey: "2026-10" },
  );
  assert.deepEqual(
    resolveResumableFirstMonthSelection(
      undefined,
      "Africa/Cairo",
      months(["2026-09", "2026-08"], ["2026-09", "2026-08"]),
      cairoBoundary,
    ),
    { kind: "default", monthKey: "2026-10" },
  );
});

test("B12A.1 resumes the latest saved incomplete non-future month by calendar identity", () => {
  assert.deepEqual(
    resolveResumableFirstMonthSelection(
      undefined,
      "Africa/Cairo",
      months(["2026-08", "2026-11", "2026-09", "2026-07"], ["2026-08"]),
      cairoBoundary,
    ),
    { kind: "default", monthKey: "2026-09" },
  );
});

test("B12A.1 ignores future-only saved drafts and respects business-timezone month rollover", () => {
  assert.deepEqual(
    resolveResumableFirstMonthSelection(
      undefined,
      "Africa/Cairo",
      months(["2026-11"], []),
      cairoBoundary,
    ),
    { kind: "default", monthKey: "2026-10" },
  );
  assert.deepEqual(
    resolveResumableFirstMonthSelection(
      undefined,
      "UTC",
      months(["2026-09"], []),
      cairoBoundary,
    ),
    { kind: "default", monthKey: "2026-09" },
  );
});

test("B12A.1 explicit valid month always wins over the resume candidate", () => {
  assert.deepEqual(
    resolveResumableFirstMonthSelection(
      "2026-08",
      "Africa/Cairo",
      months(["2026-09"], []),
      cairoBoundary,
    ),
    { kind: "valid", monthKey: "2026-08" },
  );
});

test("B12A.1 malformed or duplicate month keeps the existing safe current-month recovery", () => {
  for (const invalid of ["2026-13", "bad", ["2026-08", "2026-09"]]) {
    assert.deepEqual(
      resolveResumableFirstMonthSelection(
        invalid,
        "Africa/Cairo",
        months(["2026-09"], []),
        cairoBoundary,
      ),
      { kind: "invalid", monthKey: "2026-10" },
    );
  }
});

test("B12A.1 production route uses persisted month assessment and retains fail-closed load handling", async () => {
  const setupPage = await readFile(
    new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(setupPage, /resolveResumableFirstMonthSelection\(/);
  assert.match(setupPage, /loadResult\.persistedMonths/);
  assert.match(setupPage, /if \(loadResult\.kind === "load_error"\)/);
  assert.ok(
    setupPage.indexOf('if (loadResult.kind === "load_error")') <
      setupPage.indexOf("resolveResumableFirstMonthSelection("),
  );
});
