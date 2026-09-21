export type FunnelModuleTab = "structure" | "monthly" | "liquidation";

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
) {
  const base = `/businesses/${encodeURIComponent(businessId)}`;
  const month = monthKey ? `?month=${encodeURIComponent(monthKey)}` : "";

  switch (tab) {
    case "structure":
      return `${base}/funnels`;
    case "monthly":
      return `${base}/funnels/monthly${month}`;
    case "liquidation":
      return `${base}/liquidation${month}`;
  }
}
