import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveNavigationDestination } from "../../src/lib/navigation-hierarchy.ts";
import {
  parseReturnOrigin,
  resolveReturnOrigin,
  type ReturnOriginMetadata,
} from "../../src/lib/return-origin.ts";

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

test("N26 setup parser requires Monthly editor and validates nested customer origin metadata", () => {
  assert.deepEqual(
    parseReturnOrigin({ origin: "monthly-editor", month: "2026-09" }),
    { origin: "monthly-editor", month: "2026-09" },
  );
  assert.equal(parseReturnOrigin({ origin: "monthly-editor" }), null);
  assert.equal(parseReturnOrigin({ origin: "monthly-editor", month: "2026-13" }), null);

  assert.match(setupOriginSource, /parsed\?\.origin !== "monthly-editor"/);
  assert.match(setupOriginSource, /upstream\.origin === "monthly-editor"/);
  assert.match(
    setupOriginSource,
    /upstream\.origin === "customer-overview" && hasUpstreamMonth/,
  );
  assert.match(setupOriginSource, /upstream_origin/);
  assert.match(setupOriginSource, /upstream_month/);
  assert.doesNotMatch(setupOriginSource, /returnTo/);
});

test("N26 typed setup return restores the exact Monthly month and upstream profitability origin", () => {
  const origin: ReturnOriginMetadata = {
    origin: "monthly-editor",
    month: "2026-09",
    upstream: { origin: "customer-profitability", month: "2026-07" },
  };
  const destination = resolveReturnOrigin(origin, {
    businessId: "123e4567-e89b-42d3-a456-426614174000",
  });

  assert.equal(
    resolveNavigationDestination(destination),
    "/businesses/123e4567-e89b-42d3-a456-426614174000/monthly?month=2026-09&origin=customer-profitability&return_month=2026-07",
  );
});

test("N26 typed setup return can restore Customer Overview without inventing month metadata", () => {
  const origin: ReturnOriginMetadata = {
    origin: "monthly-editor",
    month: "2026-09",
    upstream: { origin: "customer-overview" },
  };
  const destination = resolveReturnOrigin(origin, {
    businessId: "123e4567-e89b-42d3-a456-426614174000",
  });

  assert.equal(
    resolveNavigationDestination(destination),
    "/businesses/123e4567-e89b-42d3-a456-426614174000/monthly?month=2026-09&origin=customer-overview",
  );
});

test("N26 Monthly setup URLs preserve the selected month and validated upstream customer origin", () => {
  assert.match(monthlySource, /const setupHref = \(route: "revenue-streams" \| "expenses"\) =>/);
  assert.match(monthlySource, /origin: "monthly-editor"/);
  assert.match(monthlySource, /month: selectedMonth\.monthKey/);
  assert.match(monthlySource, /queryParams\.set\("upstream_origin", returnOrigin\.origin\)/);
  assert.match(
    monthlySource,
    /queryParams\.set\("upstream_month", returnOrigin\.month\)/,
  );
  assert.match(monthlySource, /href=\{setupHref\("revenue-streams"\)\}/);
  assert.doesNotMatch(monthlySource, /returnTo/);
});

test("N26 Revenue Sources renders and submits the complete safe setup return context", () => {
  assert.match(
    revenuePageSource,
    /parseSetupReturnOrigin\(\{[\s\S]*origin: query\.origin,[\s\S]*month: query\.month,[\s\S]*upstream_origin: query\.upstream_origin,[\s\S]*upstream_month: query\.upstream_month/,
  );
  assert.match(revenuePageSource, /ariaLabel="سياق العودة من إعداد مصادر الإيراد"/);
  assert.match(revenuePageSource, /returnLabel="العودة إلى الإدخال الشهري"/);
  assert.match(revenuePageSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(revenuePageSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.match(revenuePageSource, /name="upstream_origin"/);
  assert.match(revenuePageSource, /value=\{returnOrigin\.upstream\.origin\}/);
  assert.match(revenuePageSource, /name="upstream_month"/);
  assert.match(revenuePageSource, /value=\{returnOrigin\.upstream\.month\}/);
  assert.doesNotMatch(revenuePageSource, /returnTo/);
});

test("N26 Revenue Sources actions reject ambiguous nested metadata and preserve it on redirects", () => {
  assert.match(revenueActionsSource, /formData\.getAll\("origin"\)/);
  assert.match(revenueActionsSource, /formData\.getAll\("month"\)/);
  assert.match(revenueActionsSource, /formData\.getAll\("upstream_origin"\)/);
  assert.match(revenueActionsSource, /formData\.getAll\("upstream_month"\)/);
  assert.match(revenueActionsSource, /upstreamOrigins\.length > 1/);
  assert.match(revenueActionsSource, /upstreamMonths\.length > 1/);
  assert.match(
    revenueActionsSource,
    /parseSetupReturnOrigin\(\{[\s\S]*upstream_origin: upstreamOrigin,[\s\S]*upstream_month: upstreamMonth/,
  );
  assert.match(revenueActionsSource, /query\.set\("origin", returnOrigin\.origin\)/);
  assert.match(revenueActionsSource, /query\.set\("month", returnOrigin\.month\)/);
  assert.match(
    revenueActionsSource,
    /query\.set\("upstream_origin", returnOrigin\.upstream\.origin\)/,
  );
  assert.match(
    revenueActionsSource,
    /query\.set\("upstream_month", returnOrigin\.upstream\.month\)/,
  );
  assert.match(
    revenueActionsSource,
    /redirectToRevenueStreams\(businessId, "created", returnOrigin\)/,
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
