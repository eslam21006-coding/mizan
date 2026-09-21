export type FunnelModuleTab = "structure" | "monthly" | "liquidation";
export type FunnelModuleOrigin = "funnel-structure";

export const FUNNEL_MODULE_TABS = [
  { id: "structure", label: "الهيكل" },
  { id: "monthly", label: "الأداء الشهري" },
  { id: "liquidation", label: "تسييل الإنفاق" },
] as const satisfies readonly { id: FunnelModuleTab; label: string }[];

/** Builds only known Funnel-module destinations and preserves a validated month when supplied. */
export function buildFunnelModuleHref(
  businessId: string,
  tab: FunnelModuleTab,
  monthKey?: string | null,
  origin?: FunnelModuleOrigin | null,
) {
  const base = `/businesses/${encodeURIComponent(businessId)}`;
  const query = new URLSearchParams();
  if (monthKey) query.set("month", monthKey);
  if (tab === "monthly" && origin) query.set("origin", origin);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  switch (tab) {
    case "structure":
      return `${base}/funnels`;
    case "monthly":
      return `${base}/funnels/monthly${suffix}`;
    case "liquidation":
      return `${base}/liquidation${monthKey ? `?month=${encodeURIComponent(monthKey)}` : ""}`;
  }
}
