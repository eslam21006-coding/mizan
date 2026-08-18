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
};

export const menteeNavigation: NavigationItem[] = [
  { label: "الرئيسية", href: "/", icon: "home" },
  { label: "البزنس", href: "/businesses", icon: "business" },
  { label: "الأرقام الشهرية", href: "/monthly", icon: "calendar" },
  { label: "العملاء و LTV", href: "/customers", icon: "customers" },
  { label: "الفانلز", href: "/funnels", icon: "funnel" },
  { label: "المحاكي", href: "/simulator", icon: "simulator" },
  { label: "خطة الوصول للهدف", href: "/target-plan", icon: "target" },
  { label: "التحليلات", href: "/analytics", icon: "analytics" },
  { label: "الإعدادات", href: "/settings", icon: "settings" },
];

const adminNavigation: NavigationItem[] = [
  { label: "دعوة المتدربين", href: "/admin/invites", icon: "customers" },
];

export function getNavigation(role: MizanRole) {
  return role === "admin" ? [...menteeNavigation, ...adminNavigation] : menteeNavigation;
}
