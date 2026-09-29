import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const setupLoaderSource = await readFile(
  new URL("../../src/lib/business/setup-loader.ts", import.meta.url),
  "utf8",
);

test("B06-A setup loader returns revenue rows while readiness still counts active sources only", () => {
  assert.match(setupLoaderSource, /\.select\("id,name,stream_type,is_active"\)/);
  assert.doesNotMatch(setupLoaderSource, /\.eq\("is_active", true\)/);
  assert.match(
    setupLoaderSource,
    /const revenueSourceCount = revenueSources\.filter\(\(stream\) => stream\.isActive\)\.length/,
  );
  assert.match(setupLoaderSource, /revenueSources,/);
  assert.match(setupLoaderSource, /revenueSourceCount,/);
});

test("B06-A setup loading remains read-only", () => {
  assert.doesNotMatch(setupLoaderSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});


const setupShellSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/setup/business-setup-shell.tsx",
    import.meta.url,
  ),
  "utf8",
);
const setupPageSource = await readFile(
  new URL("../../src/app/(app)/businesses/[businessId]/setup/page.tsx", import.meta.url),
  "utf8",
);

test("B06-B Money-In UI asks only for a source name and hides advanced classification", () => {
  assert.match(setupShellSource, /ما الذي تبيعُه أو تحصل منه على إيراد؟/);
  assert.match(setupShellSource, /اسم المنتج أو الخدمة/);
  assert.match(setupShellSource, /مثال: الكورس الأساسي/);
  assert.match(setupShellSource, /إضافة مصدر الإيراد/);
  assert.match(setupShellSource, /مصادر الإيراد التي أضفتها/);
  assert.doesNotMatch(setupShellSource, /Front-End|Backend|أمامي|خلفي/);
});

test("B06-B setup form uses conservative hidden classification and preserves explicit Next", () => {
  assert.match(setupShellSource, /name="stream_type" value="other"/);
  assert.match(setupShellSource, /name="destination" value="setup"/);
  assert.doesNotMatch(setupShellSource, /redirect\([^)]*expenses/);
  assert.match(setupPageSource, /nextEnabled = loadResult\.readiness\.stepComplete\[currentStep\]/);
});

test("B06-B read-only setup hides revenue mutation form while still listing sources", () => {
  assert.match(setupShellSource, /\{canManage && creationRequestId \? \(/);
  assert.match(setupShellSource, /revenueSources\.map/);
  assert.match(setupShellSource, /غير نشط/);
});


const revenueActionsSource = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/revenue-streams/actions.ts",
    import.meta.url,
  ),
  "utf8",
);

test("B06-C revenue creation reuses one action with a strict internal destination", () => {
  assert.match(revenueActionsSource, /type RevenueMutationDestination = "workspace" \| "setup"/);
  assert.match(revenueActionsSource, /formData\.getAll\("destination"\)/);
  assert.doesNotMatch(revenueActionsSource, /https?:\/\//);
  assert.match(revenueActionsSource, /destination === "setup"/);
  assert.match(revenueActionsSource, /buildBusinessSetupHref\(businessId, "revenue"\)/);
});

test("B06-C setup creation preserves existing validation, idempotency, and the authoritative table", () => {
  assert.match(revenueActionsSource, /normalizeRevenueStreamName/);
  assert.match(revenueActionsSource, /parseRevenueStreamType/);
  assert.match(revenueActionsSource, /parseResourceId\(formData\.get\("creation_request_id"\)\)/);
  assert.match(revenueActionsSource, /\.from\("revenue_streams"\)\.insert/);
  assert.match(revenueActionsSource, /!error \|\| error\.code === "23505"/);
  assert.doesNotMatch(revenueActionsSource, /from\("setup_revenue/);
});

test("B06-C existing workspace and Monthly return behavior remains the default", () => {
  assert.match(revenueActionsSource, /if \(values\.length === 0\) return "workspace"/);
  assert.match(revenueActionsSource, /destination === "workspace" \? parseRevenueSetupReturnOrigin/);
  assert.match(revenueActionsSource, /redirectToRevenueStreams\(businessId, status, returnOrigin\)/);
});


import { resolveBusinessSetupReadiness } from "../../src/lib/business/setup-readiness.ts";

test("B06-D Revenue readiness is active-count driven across known states", () => {
  for (const count of [1, 3]) {
    const ready = resolveBusinessSetupReadiness({
      loadState: "loaded",
      revenueSourceCount: count,
      expenseSetupReviewedAt: null,
      validMonthCount: 0,
    });
    assert.equal(ready.stepComplete.revenue, true);
  }

  const empty = resolveBusinessSetupReadiness({
    loadState: "loaded",
    revenueSourceCount: 0,
    expenseSetupReviewedAt: null,
    validMonthCount: 0,
  });
  assert.equal(empty.stepComplete.revenue, false);
});

test("B06-D setup changes do not add a new revenue model or schema mutation", () => {
  assert.doesNotMatch(setupShellSource, /price|cash_collected|attributed_revenue|refund/i);
  assert.doesNotMatch(revenueActionsSource, /from\("setup_revenue/);
  assert.doesNotMatch(revenueActionsSource, /owner_user_id/);
});
