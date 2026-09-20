import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseReturnOrigin } from "../../src/lib/return-origin.ts";

const setupOriginSource = readFileSync("src/lib/setup-return-origin.ts", "utf8");
const monthlySource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/page.tsx",
  "utf8",
);
const revenuePageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/page.tsx",
  "utf8",
);
const revenueActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/actions.ts",
  "utf8",
);

test("N26 setup parser is constrained to an exact Monthly editor origin", () => {
  assert.deepEqual(
    parseReturnOrigin({ origin: "monthly-editor", month: "2026-09" }),
    { origin: "monthly-editor", month: "2026-09" },
  );
  assert.equal(parseReturnOrigin({ origin: "monthly-editor" }), null);
  assert.equal(
    parseReturnOrigin({ origin: "monthly-editor", month: "2026-13" }),
    null,
  );
  assert.equal(
    parseReturnOrigin({
      origin: ["monthly-editor", "monthly-editor"],
      month: "2026-09",
    }),
    null,
  );
  assert.match(
    setupOriginSource,
    /parsed\?\.origin === "monthly-editor" \? parsed : null/,
  );
  assert.doesNotMatch(setupOriginSource, /customer-overview|customer-profitability/);
});

test("N26 Monthly opens Revenue Sources with the selected month as structured origin", () => {
  assert.match(
    monthlySource,
    /revenue-streams\?\$\{new URLSearchParams\(\{[\s\S]*origin: "monthly-editor",[\s\S]*month: selectedMonth\.monthKey/,
  );
  assert.doesNotMatch(monthlySource, /returnTo/);
});

test("N26 Revenue Sources renders and submits the safe Monthly return context", () => {
  assert.match(
    revenuePageSource,
    /parseSetupReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.month/,
  );
  assert.match(revenuePageSource, /ariaLabel="سياق العودة من إعداد مصادر الإيراد"/);
  assert.match(revenuePageSource, /returnLabel="العودة إلى الإدخال الشهري"/);
  assert.match(revenuePageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(revenuePageSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.doesNotMatch(revenuePageSource, /returnTo/);
});

test("N26 Revenue Sources actions reject ambiguous metadata and preserve safe context", () => {
  assert.match(revenueActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(revenueActionsSource, /formData\.getAll\("month"\)/);
  assert.match(
    revenueActionsSource,
    /origins\.length !== 1 \|\| months\.length !== 1/,
  );
  assert.match(
    revenueActionsSource,
    /parseSetupReturnOrigin\(\{ origin, month \}\)/,
  );
  assert.match(revenueActionsSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(revenueActionsSource, /query\.set\("month", returnOrigin\.month\)/);
  assert.match(
    revenueActionsSource,
    /redirectToRevenueStreams\(businessId, "created", returnOrigin\)/,
  );
  assert.match(
    revenueActionsSource,
    /redirectToRevenueStreams\(businessId, "updated", returnOrigin\)/,
  );
  assert.match(
    revenueActionsSource,
    /redirectToRevenueStreams\(businessId, "deleted", returnOrigin\)/,
  );
  assert.match(
    revenueActionsSource,
    /revenueStreamsPath\(businessId, "create-failed", returnOrigin\)/,
  );
  assert.match(
    revenueActionsSource,
    /revenueStreamsPath\(businessId, "update-failed", returnOrigin\)/,
  );
  assert.match(
    revenueActionsSource,
    /revenueStreamsPath\(businessId, "delete-failed", returnOrigin\)/,
  );
  assert.doesNotMatch(revenueActionsSource, /returnTo/);
});
