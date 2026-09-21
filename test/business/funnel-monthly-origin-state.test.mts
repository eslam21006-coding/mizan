import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildFunnelModuleHref } from "../../src/lib/funnel-module.ts";
import { parseFunnelMonthlyReturnOrigin } from "../../src/lib/funnel-monthly-return-origin.ts";
import {
  parseReturnOrigin,
  resolveReturnOrigin,
} from "../../src/lib/return-origin.ts";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";

const monthlyPageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/page.tsx",
  "utf8",
);
const monthlyActionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/funnels/monthly/actions.ts",
  "utf8",
);

/** N45 accepts only the allow-listed Funnel Structure origin and rejects ambiguity. */
test("N45 parses only a single Funnel Structure origin", () => {
  assert.deepEqual(
    parseFunnelMonthlyReturnOrigin({ origin: "funnel-structure" }),
    { origin: "funnel-structure" },
  );
  assert.equal(
    parseFunnelMonthlyReturnOrigin({ origin: "customer-overview" }),
    null,
  );
  assert.equal(
    parseFunnelMonthlyReturnOrigin({ origin: "https://evil.example" }),
    null,
  );

  const duplicated = new URLSearchParams();
  duplicated.append("origin", "funnel-structure");
  duplicated.append("origin", "funnel-structure");
  assert.equal(parseFunnelMonthlyReturnOrigin(duplicated), null);
});

/** N45 resolves Return through typed navigation and never through an arbitrary return URL. */
test("N45 resolves Funnel Structure Return deterministically", () => {
  const origin = parseReturnOrigin({
    origin: "funnel-structure",
    returnTo: "https://evil.example",
  });
  assert.deepEqual(origin, { origin: "funnel-structure" });
  assert.ok(origin);

  assert.equal(
    resolveNavigationDestination(
      resolveReturnOrigin(origin, { businessId: "business fixture/01" }),
    ),
    "/businesses/business%20fixture%2F01/funnels",
  );
});

/** N45 marks only Structure to Monthly local navigation with the workflow origin. */
test("N45 builds the Structure to Monthly origin URL without contaminating other tabs", () => {
  assert.equal(
    buildFunnelModuleHref(
      "business fixture/01",
      "monthly",
      "2026-09",
      "funnel-structure",
    ),
    "/businesses/business%20fixture%2F01/funnels/monthly?month=2026-09&origin=funnel-structure",
  );
  assert.equal(
    buildFunnelModuleHref(
      "business fixture/01",
      "liquidation",
      "2026-09",
      "funnel-structure",
    ),
    "/businesses/business%20fixture%2F01/liquidation?month=2026-09",
  );
});

/** N45 keeps the origin in Funnel Monthly UI month changes and saves. */
test("N45 Funnel Monthly UI preserves the structured origin", () => {
  assert.match(
    monthlyPageSource,
    /parseFunnelMonthlyReturnOrigin\(\{ origin: query\.origin \}\)/,
  );
  assert.match(
    monthlyPageSource,
    /ariaLabel="سياق العودة من أرقام الفانلز الشهرية"/,
  );
  assert.match(
    monthlyPageSource,
    /<form>[\s\S]*name="origin" value=\{returnOrigin\.origin\}[\s\S]*name="month"/,
  );
  assert.match(
    monthlyPageSource,
    /action=\{canManage \? saveFunnelMonthlyActuals : undefined\}[\s\S]*name="month" value=\{selectedMonth\.monthKey\}[\s\S]*name="origin" value=\{returnOrigin\.origin\}/,
  );
  assert.doesNotMatch(monthlyPageSource, /returnTo/);
});

/** N45 save redirects preserve only a single validated Funnel Structure origin. */
test("N45 Funnel Monthly actions preserve safe origin across redirect outcomes", () => {
  assert.match(monthlyActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(monthlyActionsSource, /origins\.length !== 1/);
  assert.match(
    monthlyActionsSource,
    /parseFunnelMonthlyReturnOrigin\(\{ origin: origins\[0\] \}\)/,
  );
  assert.match(
    monthlyActionsSource,
    /if \(returnOrigin\) query\.set\("origin", returnOrigin\.origin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectFunnelMonthly\(businessId, month\.monthKey, "invalid-input", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectFunnelMonthly\(businessId, month\.monthKey, "save-failed", returnOrigin\)/,
  );
  assert.match(
    monthlyActionsSource,
    /redirectFunnelMonthly\(businessId, month\.monthKey, "saved", returnOrigin\)/,
  );
  assert.doesNotMatch(monthlyActionsSource, /returnTo/);
});
