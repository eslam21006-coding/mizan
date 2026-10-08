import type { MizanRole } from "@/lib/auth/role";

export type NavigationIcon =
  | "home"
  | "business"
  | "calendar"
  | "customers"
  | "funnel"
  | "simulator"
  | "target"
  | "analytics"
  | "settings";

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIcon;
  activeRoutes?: readonly string[];
};

export type NavigationModel = {
  primary: readonly NavigationItem[];
  secondary: readonly NavigationItem[];
  admin: readonly NavigationItem[];
};

export const simplifiedPrimaryNavigation: readonly NavigationItem[] = [
  { label: "الرئيسية", href: "/", icon: "home", activeRoutes: ["/"] },
  {
    label: "الأرقام",
    href: "/monthly",
    icon: "calendar",
    activeRoutes: ["/monthly", "/analytics"],
  },
  {
    label: "العملاء",
    href: "/customers",
    icon: "customers",
    activeRoutes: ["/customers"],
  },
  { label: "المبيعات", href: "/funnels", icon: "funnel", activeRoutes: ["/funnels"] },
  {
    label: "التخطيط",
    href: "/target-plan",
    icon: "target",
    activeRoutes: ["/target-plan", "/simulator"],
  },
];

export const simplifiedSecondaryNavigation: readonly NavigationItem[] = [
  {
    label: "أهم الملاحظات",
    href: "/insights",
    icon: "analytics",
    activeRoutes: ["/insights"],
  },
  { label: "الإعدادات", href: "/settings", icon: "settings", activeRoutes: ["/settings"] },
];

export const simplifiedAdminNavigation: readonly NavigationItem[] = [
  {
    label: "المتدربون",
    href: "/admin/mentees",
    icon: "customers",
    activeRoutes: ["/admin/mentees"],
  },
  {
    label: "الدعوات",
    href: "/admin/invites",
    icon: "customers",
    activeRoutes: ["/admin/invites"],
  },
];

export function getSimplifiedNavigation(role: MizanRole): NavigationModel {
  return {
    primary: simplifiedPrimaryNavigation,
    secondary: simplifiedSecondaryNavigation,
    admin: role === "admin" ? simplifiedAdminNavigation : [],
  };
}

function routeMatchesPathname(route: string, pathname: string) {
  return route === "/"
    ? pathname === "/"
    : pathname === route || pathname.startsWith(`${route}/`);
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  const activeRoutes = item.activeRoutes ?? [item.href];
  return activeRoutes.some((route) => routeMatchesPathname(route, pathname));
}

/**
 * Legacy flat navigation retained until B13B switches AppNavigation to the
 * simplified grouped model. Keeping it here prevents B13A from exposing a
 * half-converted production navigation between sequential sub-batches.
 */
export const menteeNavigation: NavigationItem[] = [
  { label: "الرئيسية", href: "/", icon: "home" },
  { label: "البزنس", href: "/businesses", icon: "business" },
  { label: "الأرقام الشهرية", href: "/monthly", icon: "calendar" },
  { label: "العملاء وقيمة العميل", href: "/customers", icon: "customers" },
  { label: "الفانلز", href: "/funnels", icon: "funnel" },
  { label: "المحاكي", href: "/simulator", icon: "simulator" },
  { label: "خطة الوصول للهدف", href: "/target-plan", icon: "target" },
  { label: "أهم الملاحظات", href: "/insights", icon: "analytics" },
  { label: "التحليلات", href: "/analytics", icon: "analytics" },
  { label: "الإعدادات", href: "/settings", icon: "settings" },
];

const adminNavigation: NavigationItem[] = [
  { label: "المتدربون", href: "/admin/mentees", icon: "customers" },
  { label: "الدعوات", href: "/admin/invites", icon: "customers" },
];

export function getNavigation(role: MizanRole) {
  return role === "admin" ? [...menteeNavigation, ...adminNavigation] : menteeNavigation;
}
