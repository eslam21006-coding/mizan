"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  buildCustomerAnalysisViewHref,
  type CustomerAnalysisView,
  type CustomerSearchParams,
} from "@/lib/customer-analysis-view";
import styles from "./customer-groups.module.css";
import uxStyles from "./customer-analysis-ux.module.css";

type CustomerAnalysisPanel = {
  id: CustomerAnalysisView;
  label: string;
  eyebrow: string;
  content: ReactNode;
};

type CustomerAnalysisTabsProps = {
  businessId: string;
  activeView: CustomerAnalysisView;
  searchParams: CustomerSearchParams;
  panels: CustomerAnalysisPanel[];
  tabBasePath?: string;
};

/** Keeps deeper customer analyses URL-addressable without stacking full tables on one page. */
export function CustomerAnalysisTabs({
  businessId,
  activeView,
  searchParams,
  panels,
  tabBasePath,
}: CustomerAnalysisTabsProps) {
  const instanceId = useId().replaceAll(":", "");
  const activeIndex = Math.max(
    0,
    panels.findIndex((panel) => panel.id === activeView),
  );
  const [visitedIndexes, setVisitedIndexes] = useState(() => new Set([activeIndex]));
  const tabRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    setVisitedIndexes((current) => {
      if (current.has(activeIndex)) return current;
      const next = new Set(current);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  /** Moves focus and selection together through URL navigation for the RTL tab list. */
  const selectTab = (index: number) => {
    const normalizedIndex = (index + panels.length) % panels.length;
    const target = tabRefs.current[normalizedIndex];
    target?.focus();
    target?.click();
  };

  /** Applies horizontal RTL keyboard behavior plus Home/End navigation to the tab list. */
  const onTabKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(index + 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(panels.length - 1);
    }
  };

  return (
    <section className={styles.analysisSection} aria-labelledby="customer-analysis-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>التفاصيل عند الحاجة</span>
          <h2 id="customer-analysis-title">اختر ما تريد معرفته عن عملائك</h2>
          <p>ابدأ بالنظرة العامة، ثم افتح قيمة العميل أو الربحية أو باقي التفاصيل عندما تحتاجها.</p>
        </div>
      </div>

      <div className={styles.analysisTabs} role="tablist" aria-label="أقسام تحليل العملاء">
        {panels.map((panel, index) => {
          const selected = activeIndex === index;
          return (
            <Link
              key={panel.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${instanceId}-${panel.id}-tab`}
              href={buildCustomerAnalysisViewHref(
                businessId,
                searchParams,
                panel.id,
                tabBasePath,
              )}
              scroll={false}
              role="tab"
              aria-selected={selected}
              aria-controls={`${instanceId}-${panel.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.analysisTab} ${uxStyles.analysisTabEmphasis} ${selected ? `${styles.analysisTabActive} ${uxStyles.analysisTabActiveEmphasis}` : ""}`}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <strong>{panel.label}</strong>
              <span>{panel.eyebrow}</span>
            </Link>
          );
        })}
      </div>

      <div className={styles.analysisPanelShell}>
        {panels.map((panel, index) => (
          <div
            key={panel.id}
            id={`${instanceId}-${panel.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${instanceId}-${panel.id}-tab`}
            hidden={activeIndex !== index}
            className={styles.analysisPanel}
          >
            {visitedIndexes.has(index) || activeIndex === index ? panel.content : null}
          </div>
        ))}
      </div>
    </section>
  );
}
