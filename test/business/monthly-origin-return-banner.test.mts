import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monthlyOriginSource = readFileSync("src/lib/monthly-return-origin.ts", "utf8");
const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/actions.ts",
  "utf8",
);

/** Locks Monthly Return to safe cross-module origins and keeps same-module/import origins out of the banner. */
test("Monthly accepts only external structured Return origins", () => {
  assert.match(monthlyOriginSource, /parsed\?\.origin === "customer-overview"/);
  assert.match(monthlyOriginSource, /parsed\?\.origin === "customer-profitability"/);
  assert.doesNotMatch(monthlyOriginSource, /returnTo/);
  assert.match(
    monthlyPageSource,
    /parseMonthlyExternalReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.return_month \?\? query\.month/,
  );
  assert.match(monthlyPageSource, /ariaLabel="سياق العودة من الإدخال الشهري"/);
  assert.doesNotMatch(monthlyPageSource, /returnTo/);
});

/** Locks Monthly navigation controls to preserve the safe workflow origin and original Return month. */
test("Monthly month navigation and setup-copy controls preserve Return context", () => {
  assert.match(monthlyPageSource, /const monthlyHref = \(monthKey: string\) =>/);
  assert.match(monthlyPageSource, /queryParams\.set\("origin", returnOrigin\.origin\)/);
  assert.match(monthlyPageSource, /queryParams\.set\("return_month", returnOrigin\.month\)/);
  assert.match(monthlyPageSource, /href=\{monthlyHref\(previousMonth\)\}/);
  assert.match(monthlyPageSource, /href=\{monthlyHref\(nextMonth\)\}/);
  assert.match(
    monthlyPageSource,
    /className=\{styles\.monthPicker\}[\s\S]*name="origin" value=\{returnOrigin\.origin\}/,
  );
  assert.match(
    monthlyPageSource,
    /action=\{copyPreviousMonthExpenses\}[\s\S]*name="origin" value=\{returnOrigin\.origin\}/,
  );
  assert.match(monthlyPageSource, /name="return_month" value=\{returnOrigin\.month\}/);
});

/** Locks save/copy redirects to the same validated origin and source Return month. */
test("Monthly actions preserve safe Return context across save and copy outcomes", () => {
  assert.match(monthlyActionsSource, /rawReturnMonth = formData\.get\("return_month"\)/);
  assert.match(
    monthlyActionsSource,
    /parseMonthlyExternalReturnOrigin\(\{ origin: rawOrigin, month: rawMonth \}\)/,
  );
  assert.match(monthlyActionsSource, /query\.set\("return_month", returnOrigin\.month\)/);
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "saved", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "save-failed", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "copy-failed", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectMonthly\(businessId, month\.monthKey, "no-previous", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /monthlyPath\(businessId, month\.monthKey, "copied", copiedCount, returnOrigin\)/,
  );
  assert.doesNotMatch(monthlyActionsSource, /returnTo/);
});
