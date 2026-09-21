export type BusinessWorkspaceTab =
  | "overview"
  | "revenue-streams"
  | "expenses"
  | "settings";

export const BUSINESS_WORKSPACE_TABS = [
  { id: "overview", label: "نظرة عامة" },
  { id: "revenue-streams", label: "مصادر الإيراد" },
  { id: "expenses", label: "هيكل المصروفات" },
  { id: "settings", label: "الإعدادات" },
] as const satisfies readonly { id: BusinessWorkspaceTab; label: string }[];

/** Builds only known business-workspace destinations; arbitrary return URLs are never accepted. */
export function buildBusinessWorkspaceHref(
  businessId: string,
  tab: BusinessWorkspaceTab,
) {
  const base = `/businesses/${encodeURIComponent(businessId)}`;

  switch (tab) {
    case "overview":
      return base;
    case "revenue-streams":
      return `${base}/revenue-streams`;
    case "expenses":
      return `${base}/expenses`;
    case "settings":
      return `${base}/settings`;
  }
}
