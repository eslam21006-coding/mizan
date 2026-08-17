export type NavigationIcon =
  | "home"
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
  { label: "الأرقام الشهرية", href: "/monthly", icon: "calendar" },
  { label: "العملاء و LTV", href: "/customers", icon: "customers" },
  { label: "الفانلز", href: "/funnels", icon: "funnel" },
  { label: "المحاكي", href: "/simulator", icon: "simulator" },
  { label: "خطة الوصول للهدف", href: "/target-plan", icon: "target" },
  { label: "التحليلات", href: "/analytics", icon: "analytics" },
  { label: "الإعدادات", href: "/settings", icon: "settings" },
];
