import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/actions.ts",
  "utf8",
);

test("N25 keeps Monthly Return tied to the originating profitability month", () => {
  assert.match(
    monthlyPageSource,
    /parseReturnOrigin\(\{\s*origin:\s*query\.origin,\s*month:\s*query\.month\s*\}\)/,
  );
  assert.match(monthlyPageSource, /purpose="بيانات مطلوبة في ربحية العميل"/);
  assert.match(monthlyPageSource, /returnLabel="العودة إلى ربحية العميل"/);
});

test("N25 preserves the allow-listed origin across Monthly local navigation and forms", () => {
  assert.match(monthlyPageSource, /function monthlyHref\(/);
  assert.match(monthlyPageSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(
    monthlyPageSource,
    /href=\{monthlyHref\(businessId, previousMonth, returnOrigin\)\}/,
  );
  assert.match(
    monthlyPageSource,
    /href=\{monthlyHref\(businessId, nextMonth, returnOrigin\)\}/,
  );

  const hiddenOriginFields =
    monthlyPageSource.match(
      /<input type="hidden" name="origin" value=\{returnOrigin\.origin\} \/>/g,
    ) ?? [];
  assert.ok(
    hiddenOriginFields.length >= 3,
    "month picker, copy action, and save action must all preserve the workflow origin",
  );
});

test("N25 preserves the structured origin through Monthly server-action redirects", () => {
  assert.match(
    monthlyActionsSource,
    /parseReturnOrigin\(\{ origin: rawOrigin, month: rawMonth \}\)/,
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
});
