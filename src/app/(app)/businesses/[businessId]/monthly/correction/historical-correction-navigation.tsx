import { BusinessContext } from "@/components/business-context";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import type { MonthlyExternalReturnOrigin } from "@/lib/monthly-return-origin";
import type { BreadcrumbItem } from "@/lib/navigation-hierarchy";

type HistoricalCorrectionNavigationProps = {
  businessId: string;
  businessName: string;
  baseCurrency: string;
  timezone: string;
  monthKey: string;
  monthLabel: string;
  returnOrigin?: MonthlyExternalReturnOrigin | null;
};

/** Keeps historical correction inside the Monthly hierarchy and returns to the exact source month. */
export function HistoricalCorrectionNavigation({
  businessId,
  businessName,
  baseCurrency,
  timezone,
  monthKey,
  monthLabel,
  returnOrigin = null,
}: HistoricalCorrectionNavigationProps) {
  const monthlyDestination = {
    route: "business-monthly" as const,
    businessId,
    month: monthKey,
    origin: returnOrigin?.origin,
    returnMonth:
      returnOrigin?.origin === "customer-profitability" ||
      returnOrigin?.origin === "insights"
        ? returnOrigin.month
        : undefined,
    insightRuleId:
      returnOrigin?.origin === "insights" ? returnOrigin.ruleId : undefined,
    insightSubjectId:
      returnOrigin?.origin === "insights" ? returnOrigin.subjectId : undefined,
    plannerStep:
      returnOrigin?.origin === "target-planner" ? returnOrigin.step : undefined,
    plannerGoal:
      returnOrigin?.origin === "target-planner" ? returnOrigin.goal : undefined,
    plannerValue:
      returnOrigin?.origin === "target-planner" ? returnOrigin.value : undefined,
  };

  const breadcrumbItems = [
    { label: "البزنسات", destination: { route: "businesses" } },
    {
      label: businessName,
      destination: { route: "business-overview", businessId },
    },
    {
      label: "الإدخال الشهري",
      destination: monthlyDestination,
    },
    { label: "تصحيح تاريخي", current: true },
  ] satisfies readonly BreadcrumbItem[];

  return (
    <>
      <BusinessContext
        businessName={businessName}
        baseCurrency={baseCurrency}
        timezone={timezone}
      />
      <Breadcrumb items={breadcrumbItems} />
      <BackLink label={`العودة إلى ${monthLabel}`} destination={monthlyDestination} />
    </>
  );
}
