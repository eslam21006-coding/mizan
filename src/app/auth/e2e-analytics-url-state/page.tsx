import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  parseAnalyticsView,
  type AnalyticsViewHrefState,
} from "@/lib/analytics-view";
import { parseHistoricalPeriodMode } from "@/lib/business/historical-period";
import { AnalyticsViewTabs } from "@/app/(app)/analytics/analytics-view-tabs";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type SearchParamValue = string | string[] | undefined;

type AnalyticsFixturePageProps = {
  searchParams: Promise<{
    business?: SearchParamValue;
    month?: SearchParamValue;
    view?: SearchParamValue;
    period?: SearchParamValue;
    start?: SearchParamValue;
    end?: SearchParamValue;
  }>;
};

function single(value: SearchParamValue, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

/** Renders the CI-only Analytics URL-state fixture without database or financial dependencies. */
export default async function AnalyticsUrlStateFixturePage({
  searchParams,
}: AnalyticsFixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const activeView = parseAnalyticsView(query.view);
  const state: AnalyticsViewHrefState = {
    businessId: single(query.business, "business fixture/01"),
    month: single(query.month, "2026-08"),
    period: parseHistoricalPeriodMode(query.period),
    start: single(query.start, "2026-06"),
    end: single(query.end, "2026-08"),
  };

  return (
    <AppShell {...fixtureShellProps}>
      <main className="page-stack">
        <h1>التحليلات المالية</h1>
        <AnalyticsViewTabs
          activeView={activeView}
          state={state}
          basePath="/auth/e2e-analytics-url-state"
        />
        <section
          className="panel"
          data-testid={activeView === "comparison" ? "analytics-comparison" : "analytics-trends"}
        >
          <h2>{activeView === "comparison" ? "مقارنة شهرية" : "اتجاهات تاريخية"}</h2>
          <p data-testid="analytics-period">الفترة: {state.period}</p>
          <p data-testid="analytics-month">الشهر: {state.month}</p>
        </section>
      </main>
    </AppShell>
  );
}
