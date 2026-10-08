import assert from "node:assert/strict";
import test from "node:test";
import {
  getSimplifiedNavigation,
  isNavigationItemActive,
  type NavigationItem,
} from "../../src/lib/navigation.ts";

test("B13A exposes the exact simplified Mentee navigation hierarchy", () => {
  const navigation = getSimplifiedNavigation("mentee");

  assert.deepEqual(
    navigation.primary.map(({ label, href }) => ({ label, href })),
    [
      { label: "الرئيسية", href: "/" },
      { label: "الأرقام", href: "/monthly" },
      { label: "العملاء", href: "/customers" },
      { label: "المبيعات", href: "/funnels" },
      { label: "التخطيط", href: "/target-plan" },
    ],
  );

  assert.deepEqual(
    navigation.secondary.map(({ label, href }) => ({ label, href })),
    [
      { label: "أهم الملاحظات", href: "/insights" },
      { label: "الإعدادات", href: "/settings" },
    ],
  );

  assert.deepEqual(navigation.admin, []);
});

test("B13A keeps Admin navigation separate from the product hierarchy", () => {
  const navigation = getSimplifiedNavigation("admin");

  assert.deepEqual(
    navigation.admin.map(({ label, href }) => ({ label, href })),
    [
      { label: "المتدربون", href: "/admin/mentees" },
      { label: "الدعوات", href: "/admin/invites" },
    ],
  );

  assert.equal(navigation.primary.length, 5);
  assert.equal(navigation.secondary.length, 2);
});

test("B13A resolves simplified navigation route families deterministically", () => {
  const navigation = getSimplifiedNavigation("admin");
  const items = [...navigation.primary, ...navigation.secondary, ...navigation.admin];

  const activeLabelFor = (pathname: string) =>
    items.find((item) => isNavigationItemActive(item, pathname))?.label ?? null;

  const businessId = "11111111-2222-4333-8444-555555555555";
  const cases: Array<[string, string | null]> = [
    ["/", "الرئيسية"],
    ["/monthly", "الأرقام"],
    ["/monthly/history", "الأرقام"],
    ["/analytics", "الأرقام"],
    ["/analytics/range", "الأرقام"],
    [`/businesses/${businessId}/monthly`, "الأرقام"],
    [`/businesses/${businessId}/monthly/history`, "الأرقام"],
    ["/customers", "العملاء"],
    ["/customers/import", "العملاء"],
    [`/businesses/${businessId}/customers`, "العملاء"],
    [`/businesses/${businessId}/customers/import`, "العملاء"],
    ["/funnels", "المبيعات"],
    ["/funnels/abc", "المبيعات"],
    [`/businesses/${businessId}/funnels`, "المبيعات"],
    [`/businesses/${businessId}/funnels/abc`, "المبيعات"],
    [`/businesses/${businessId}/liquidation`, "المبيعات"],
    [`/businesses/${businessId}/liquidation/details`, "المبيعات"],
    ["/target-plan", "التخطيط"],
    ["/target-plan/result", "التخطيط"],
    ["/simulator", "التخطيط"],
    ["/simulator/scenario", "التخطيط"],
    ["/insights", "أهم الملاحظات"],
    ["/settings", "الإعدادات"],
    [`/businesses/${businessId}/settings`, "الإعدادات"],
    [`/businesses/${businessId}/settings/delete`, "الإعدادات"],
    ["/admin/mentees", "المتدربون"],
    ["/admin/mentees/123", "المتدربون"],
    ["/admin/invites", "الدعوات"],
    ["/businesses", null],
    [`/businesses/${businessId}`, null],
  ];

  for (const [pathname, expected] of cases) {
    assert.equal(activeLabelFor(pathname), expected, pathname);
  }
});

test("B13A root matching does not activate Overview for unrelated paths", () => {
  const overview: NavigationItem = {
    label: "الرئيسية",
    href: "/",
    icon: "home",
    activeRoutes: ["/"],
  };

  assert.equal(isNavigationItemActive(overview, "/"), true);
  assert.equal(isNavigationItemActive(overview, "/monthly"), false);
  assert.equal(isNavigationItemActive(overview, "/anything"), false);
});

test("B13A business-scoped matching requires the expected route shape", () => {
  const navigation = getSimplifiedNavigation("mentee").primary;
  const numbers = navigation.find((item) => item.label === "الأرقام");
  const sales = navigation.find((item) => item.label === "المبيعات");
  const settings = getSimplifiedNavigation("mentee").secondary.find(
    (item) => item.label === "الإعدادات",
  );
  assert.ok(numbers);
  assert.ok(sales);
  assert.ok(settings);

  assert.equal(isNavigationItemActive(numbers, "/businesses/acme/monthly"), true);
  assert.equal(isNavigationItemActive(numbers, "/businesses/acme/monthly/history"), true);
  assert.equal(isNavigationItemActive(numbers, "/businesses/monthly"), false);
  assert.equal(isNavigationItemActive(numbers, "/businesses/acme/settings"), false);
  assert.equal(isNavigationItemActive(numbers, "/other/acme/monthly"), false);
  assert.equal(isNavigationItemActive(sales, "/businesses/acme/liquidation"), true);
  assert.equal(isNavigationItemActive(sales, "/businesses/acme/liquidation/details"), true);
  assert.equal(isNavigationItemActive(sales, "/businesses/liquidation"), false);
  assert.equal(isNavigationItemActive(settings, "/businesses/acme/settings"), true);
  assert.equal(isNavigationItemActive(settings, "/businesses/acme/settings/delete"), true);
  assert.equal(isNavigationItemActive(settings, "/businesses/settings"), false);
});

test("B13A simplified primary navigation excludes legacy module labels", () => {
  const primaryLabels = getSimplifiedNavigation("mentee").primary.map((item) => item.label);

  for (const legacyLabel of [
    "البزنس",
    "الأرقام الشهرية",
    "العملاء وقيمة العميل",
    "الفانلز",
    "المحاكي",
    "خطة الوصول للهدف",
    "أهم الملاحظات",
    "التحليلات",
    "الإعدادات",
  ]) {
    assert.equal(primaryLabels.includes(legacyLabel), false, legacyLabel);
  }
});
