import { BackLink } from "@/components/navigation-hierarchy";

type FunnelHierarchyBackProps = {
  businessId: string;
  monthKey?: string | null;
};

/** Returns from any Funnel module view to the current business, preserving month context when relevant. */
export function FunnelHierarchyBack({ businessId, monthKey }: FunnelHierarchyBackProps) {
  return (
    <BackLink
      label="العودة إلى البزنس"
      destination={{
        route: "business-overview",
        businessId,
        ...(monthKey ? { month: monthKey } : {}),
      }}
    />
  );
}
