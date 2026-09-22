import Link from "next/link";
import {
  buildAnalyticsViewHref,
  type AnalyticsView,
  type AnalyticsViewHrefState,
} from "@/lib/analytics-view";
import styles from "./analytics-view-tabs.module.css";

const VIEWS: Array<{ id: AnalyticsView; label: string; description: string }> = [
  {
    id: "comparison",
    label: "مقارنة شهرية",
    description: "قارن الشهر المرجعي بالشهر السابق.",
  },
  {
    id: "trends",
    label: "اتجاهات تاريخية",
    description: "حلل Rolling 3 Months أو YTD أو فترة مخصصة.",
  },
];

type AnalyticsViewTabsProps = {
  activeView: AnalyticsView;
  state: AnalyticsViewHrefState;
  basePath?: string;
};

/** Keeps Analytics sub-views URL-addressable while preserving the selected business, month, and period. */
export function AnalyticsViewTabs({
  activeView,
  state,
  basePath,
}: AnalyticsViewTabsProps) {
  return (
    <nav className={styles.viewTabs} aria-label="عرض التحليلات">
      {VIEWS.map((view) => {
        const active = view.id === activeView;
        return (
          <Link
            key={view.id}
            href={buildAnalyticsViewHref(state, view.id, basePath)}
            className={`${styles.viewTab} ${active ? styles.viewTabActive : ""}`}
            aria-current={active ? "page" : undefined}
            scroll={false}
          >
            <strong>{view.label}</strong>
            <span>{view.description}</span>
          </Link>
        );
      })}
    </nav>
  );
}
