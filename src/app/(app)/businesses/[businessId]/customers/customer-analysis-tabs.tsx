"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./customer-groups.module.css";

type CustomerAnalysisPanel = {
  id: "observed-ltv" | "revenue-streams" | "contribution" | "customers";
  label: string;
  eyebrow: string;
  content: ReactNode;
};

type CustomerAnalysisTabsProps = {
  panels: CustomerAnalysisPanel[];
};

/** Keeps deep customer analyses available without stacking four full tables on one page. */
export function CustomerAnalysisTabs({ panels }: CustomerAnalysisTabsProps) {
  const instanceId = useId().replaceAll(":", "");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visitedIndexes, setVisitedIndexes] = useState(() => new Set([0]));
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /** Selects a tab, records it as visited for lazy content mounting, and optionally moves focus. */
  const selectTab = (index: number, focus = false) => {
    const normalizedIndex = (index + panels.length) % panels.length;
    setActiveIndex(normalizedIndex);
    setVisitedIndexes((current) => {
      if (current.has(normalizedIndex)) return current;
      const next = new Set(current);
      next.add(normalizedIndex);
      return next;
    });
    if (focus) tabRefs.current[normalizedIndex]?.focus();
  };

  /** Applies horizontal RTL keyboard behavior plus Home/End navigation to the tab list. */
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(index + 1, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(index - 1, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(panels.length - 1, true);
    }
  };

  return (
    <section className={styles.analysisSection} aria-labelledby="customer-analysis-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.kicker}>من الصورة العامة إلى التفاصيل</span>
          <h2 id="customer-analysis-title">تحليل العملاء</h2>
          <p>
            ابدأ بقيمة العميل المحققة، ثم انتقل لمصدر الإيراد وربح المساهمة أو تفاصيل العملاء عند الحاجة.
          </p>
        </div>
      </div>

      <div className={styles.analysisTabs} role="tablist" aria-label="أقسام تحليل العملاء">
        {panels.map((panel, index) => {
          const selected = activeIndex === index;
          return (
            <button
              key={panel.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${instanceId}-${panel.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${instanceId}-${panel.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.analysisTab} ${selected ? styles.analysisTabActive : ""}`}
              onClick={() => selectTab(index)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span>{panel.eyebrow}</span>
              <strong>{panel.label}</strong>
            </button>
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
            {visitedIndexes.has(index) ? panel.content : null}
          </div>
        ))}
      </div>
    </section>
  );
}
