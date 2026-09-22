import type { HistoricalPeriodMode } from "./business/historical-period.ts";

export const ANALYTICS_VIEWS = ["comparison", "trends"] as const;
export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];

export type AnalyticsViewHrefState = {
  businessId: string;
  month: string;
  period: HistoricalPeriodMode;
  start: string;
  end: string;
};

/** Accepts only known Analytics views and falls back safely to monthly comparison. */
export function parseAnalyticsView(value: unknown): AnalyticsView {
  return typeof value === "string" &&
    ANALYTICS_VIEWS.includes(value as AnalyticsView)
    ? (value as AnalyticsView)
    : "comparison";
}

/** Builds a canonical Analytics view URL from known state instead of copying arbitrary query parameters. */
export function buildAnalyticsViewHref(
  state: AnalyticsViewHrefState,
  view: AnalyticsView,
  basePath = "/analytics",
) {
  const query = new URLSearchParams({
    business: state.businessId,
    month: state.month,
    view,
    period: state.period,
    start: state.start,
    end: state.end,
  });
  return `${basePath}?${query.toString()}`;
}
