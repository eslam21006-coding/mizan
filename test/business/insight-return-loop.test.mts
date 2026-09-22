import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";
import {
  parseReturnOrigin,
  resolveReturnOrigin,
} from "../../src/lib/return-origin.ts";

const insightsPanelSource = readFileSync(
  "src/app/(app)/insights/decision-insights-panel.tsx",
  "utf8",
);
const customerPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/page.tsx",
  "utf8",
);
const correctionPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/page.tsx",
  "utf8",
);
const correctionActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/monthly/correction/actions.ts",
  "utf8",
);

test("N50 parses and resolves a business insight without accepting arbitrary return URLs", () => {
  const origin = parseReturnOrigin({
    origin: "insights",
    month: "2026-09",
    insight_rule: "non_media_cost_pressure",
    returnTo: "https://evil.example",
  });
  assert.deepEqual(origin, {
    origin: "insights",
    month: "2026-09",
    ruleId: "non_media_cost_pressure",
  });
  assert.ok(origin);
  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, { businessId: "business fixture/01" }),
    ),
    "/insights?business=business+fixture%2F01&month=2026-09#insight-non_media_cost_pressure",
  );
});

test("N50 insight cards expose stable anchors matching structured Return destinations", () => {
  assert.match(insightsPanelSource, /id=\{\`insight-\$\{insight\.id\}\`\}/);
  assert.doesNotMatch(insightsPanelSource, /returnTo/);
});

test("N50 Customer Profitability renders the exact originating-insight Return banner", () => {
  assert.match(
    customerPageSource,
    /parseReturnOrigin\(\{[\s\S]*origin: customerSearchParams\.origin,[\s\S]*month: customerSearchParams\.return_month \?\? customerSearchParams\.month,[\s\S]*insight_rule: customerSearchParams\.insight_rule/,
  );
  assert.match(customerPageSource, /parsedInsightReturnOrigin\?\.origin === "insights"/);
  assert.match(customerPageSource, /returnLabel="العودة إلى الملاحظة"/);
  assert.match(customerPageSource, /ariaLabel="سياق العودة من اقتصاديات العميل"/);
});

test("N50 historical correction carries the structured insight through UI and mutation redirects", () => {
  assert.match(correctionPageSource, /parseMonthlyExternalReturnOrigin\(/);
  assert.match(correctionPageSource, /ariaLabel="سياق العودة من التصحيح التاريخي"/);
  assert.match(correctionPageSource, /<HistoricalReturnFields returnOrigin=\{returnOrigin\} \/>/);
  assert.match(correctionPageSource, /returnOrigin=\{returnOrigin\}/);
  assert.match(correctionActionsSource, /function parseCorrectionReturnOrigin/);
  assert.match(correctionActionsSource, /formData\.getAll\("insight_rule"\)/);
  assert.match(
    correctionActionsSource,
    /redirectCorrectionSuccess\(businessId, month\.monthKey, returnOrigin\)/,
  );
});
