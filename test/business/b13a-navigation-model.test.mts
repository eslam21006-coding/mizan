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

  const cases: Array<[string, string | null]> = [
    ["/", "الرئيسية"],
    ["/monthly", "الأرقام"],
    ["/monthly/history", "الأرقام"],
    ["/analytics", "الأرقام"],
    ["/analytics/range", "الأرقام"],
    ["/customers", "العملاء"],
    ["/customers/import", "العملاء"],
    ["/funnels", "المبيعات"],
    ["/funnels/abc", "المبيعات"],
    ["/target-plan", "التخطيط"],
    ["/target-plan/result", "التخطيط"],
    ["/simulator", "التخطيط"],
    ["/simulator/scenario", "التخطيط"],
    ["/insights", "أهم الملاحظات"],
    ["/settings", "الإعدادات"],
    ["/admin/mentees", "المتدربون"],
    ["/admin/mentees/123", "المتدربون"],
    ["/admin/invites", "الدعوات"],
    ["/businesses", null],
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
