import assert from "node:assert/strict";
import test from "node:test";
import {
  businessIdFromPathname,
  manageBusinessesHref,
  resolveBusinessAwareNavigationHref,
  resolveBusinessSwitchHref,
  resolveShellBusinessId,
  type ShellBusiness,
} from "../../src/lib/business-shell-context.ts";

const businesses: readonly ShellBusiness[] = [
  {
    id: "business/02",
    name: "ميزان الثانية",
    baseCurrency: "SAR",
    timezone: "Asia/Riyadh",
  },
  {
    id: "business 01",
    name: "ميزان الأولى",
    baseCurrency: "EGP",
    timezone: "Africa/Cairo",
  },
];

test("resolves scoped business context before query context and safely decodes ids", () => {
  assert.equal(businessIdFromPathname("/businesses/business%2001/monthly"), "business 01");
  assert.equal(
    resolveShellBusinessId({
      pathname: "/businesses/business%2001/monthly",
      search: "?business=business%2F02",
      businesses,
    }),
    "business 01",
  );
});

test("uses an accessible query business then falls back deterministically", () => {
  assert.equal(
    resolveShellBusinessId({
      pathname: "/target-plan",
      search: "?business=business%2F02",
      businesses,
    }),
    "business/02",
  );
  assert.equal(
    resolveShellBusinessId({
      pathname: "/",
      search: "?business=missing",
      businesses,
    }),
    "business/02",
  );
  assert.equal(
    resolveShellBusinessId({
      pathname: "/",
      businesses: [],
    }),
    null,
  );
});

test("switches top-level areas while preserving only portable context", () => {
  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/",
      search: "?business=old&month=2026-08&status=saved",
      targetBusinessId: "business 01",
    }),
    "/?business=business+01&month=2026-08",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/analytics",
      search: "?business=old&month=2026-08&period=custom&view=trends&start=2026-01&end=2026-08",
      targetBusinessId: "business/02",
    }),
    "/analytics?business=business%2F02&month=2026-08&period=custom&view=trends&start=2026-01&end=2026-08",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/target-plan",
      search: "?business=old&goal=net_profit&step=plan&value=100000",
      targetBusinessId: "business/02",
    }),
    "/target-plan?business=business%2F02&goal=net_profit&value=100000&step=plan",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/simulator",
      search: "?business=old&month=2026-08&scenario=scenario-old&status=saved&origin=target-plan",
      targetBusinessId: "business/02",
    }),
    "/simulator?business=business%2F02&month=2026-08",
  );
});

test("switches business-scoped modules without leaking deep workflow state", () => {
  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/monthly/correction",
      search: "?month=2026-07&origin=insights&return_month=2026-06",
      targetBusinessId: "business/02",
    }),
    "/businesses/business%2F02/monthly?month=2026-07",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/customers",
      search: "?view=profitability&month=2026-08",
      targetBusinessId: "business 01",
    }),
    "/businesses/business%2001/customers?view=profitability&month=2026-08",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/customers/import",
      search: "?step=review&source=gateway",
      targetBusinessId: "business 01",
    }),
    "/businesses/business%2001/customers",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/funnels/monthly",
      search: "?month=2026-08&status=saved",
      targetBusinessId: "business/02",
    }),
    "/businesses/business%2F02/funnels/monthly?month=2026-08",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/liquidation",
      search: "?month=2026-08&status=saved",
      targetBusinessId: "business/02",
    }),
    "/businesses/business%2F02/liquidation?month=2026-08",
  );

  assert.equal(
    resolveBusinessSwitchHref({
      pathname: "/businesses/old/settings/delete",
      targetBusinessId: "business/02",
    }),
    "/businesses/business%2F02/settings",
  );
});

test("makes simplified navigation business-aware without changing no-business fallbacks", () => {
  assert.equal(resolveBusinessAwareNavigationHref("/", "business 01"), "/?business=business+01");
  assert.equal(
    resolveBusinessAwareNavigationHref("/monthly", "business/02"),
    "/businesses/business%2F02/monthly",
  );
  assert.equal(
    resolveBusinessAwareNavigationHref("/customers", "business/02"),
    "/businesses/business%2F02/customers",
  );
  assert.equal(
    resolveBusinessAwareNavigationHref("/funnels", "business/02"),
    "/businesses/business%2F02/funnels",
  );
  assert.equal(
    resolveBusinessAwareNavigationHref("/target-plan", "business/02"),
    "/target-plan?business=business%2F02",
  );
  assert.equal(
    resolveBusinessAwareNavigationHref("/insights", "business/02"),
    "/insights?business=business%2F02",
  );
  assert.equal(
    resolveBusinessAwareNavigationHref("/settings", "business/02"),
    "/businesses/business%2F02/settings",
  );
  assert.equal(resolveBusinessAwareNavigationHref("/monthly", null), "/monthly");
  assert.equal(manageBusinessesHref(), "/businesses");
});
