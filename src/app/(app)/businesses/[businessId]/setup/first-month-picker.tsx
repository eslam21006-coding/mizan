"use client";

import { useEffect, useState } from "react";
import { parseMonthKey } from "@/lib/business/monthly";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import styles from "./first-month-setup.module.css";

type FirstMonthPickerProps = {
  businessId: string;
  monthKey: string;
};

/** Keeps the native month selector synchronized with URL history, including browser-restored form state. */
export function FirstMonthPicker({ businessId, monthKey }: FirstMonthPickerProps) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey);

  useEffect(() => {
    let pendingFrame: number | null = null;
    const synchronizeFromUrl = () => {
      const values = new URLSearchParams(window.location.search).getAll("month");
      const parsed = values.length === 1 ? parseMonthKey(values[0]) : null;
      setSelectedMonth(parsed?.monthKey ?? monthKey);
    };
    const afterHistoryRestoration = () => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        synchronizeFromUrl();
      });
    };

    window.addEventListener("pageshow", afterHistoryRestoration);
    window.addEventListener("popstate", afterHistoryRestoration);
    afterHistoryRestoration();

    return () => {
      window.removeEventListener("pageshow", afterHistoryRestoration);
      window.removeEventListener("popstate", afterHistoryRestoration);
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    };
  }, [monthKey]);

  return (
    <form method="get" action={buildBusinessSetupHref(businessId)} className={styles.monthPicker}>
      <input type="hidden" name="step" value="month" />
      <label htmlFor="first-month-selection">انتقل مباشرة إلى شهر</label>
      <div className={styles.monthPickerControls}>
        <input
          id="first-month-selection"
          name="month"
          type="month"
          min="2000-01"
          max="2200-12"
          required
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.currentTarget.value)}
          aria-label="الشهر"
        />
        <button type="submit">فتح الشهر</button>
      </div>
    </form>
  );
}
