import { BusinessContext } from "@/components/business-context";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import type { BreadcrumbItem } from "@/lib/navigation-hierarchy";

type MonthlyNavigationShellProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
};

/** Renders Monthly's business context and deterministic hierarchy without mixing in workflow Return state. */
export function MonthlyNavigationShell({
  businessId,
  businessName,
  baseCurrency,
  timezone,
}: MonthlyNavigationShellProps) {
  const breadcrumbItems = [
    { label: "البزنسات", destination: { route: "businesses" } },
    {
      label: businessName,
      destination: { route: "business-overview", businessId },
    },
    { label: "الإدخال الشهري", current: true },
  ] satisfies readonly BreadcrumbItem[];

  return (
    <>
      <BusinessContext
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
      />
      <Breadcrumb items={breadcrumbItems} />
      <BackLink
        label="العودة إلى البزنس"
        destination={{ route: "business-overview", businessId }}
      />
    </>
  );
}
