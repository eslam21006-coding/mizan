"use client";

import { useEffect, useRef, useState } from "react";
import { parseMonthKey } from "@/lib/business/monthly";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import styles from "./first-month-setup.module.css";

type FirstMonthPickerProps = {
  businessId: string;
  monthKey: string;
};

/** Keeps the native month selector synchronized with URL history without overwriting an active user edit. */
export function FirstMonthPicker({ businessId, monthKey }: FirstMonthPickerProps) {
  const [selectedMonth, setSelectedMonth] = useState(monthKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const synchronizeFromUrl = () => {
      const values = new URLSearchParams(window.location.search).getAll("month");
      const parsed = values.length === 1 ? parseMonthKey(values[0]) : null;
      const canonicalMonth = parsed?.monthKey ?? monthKey;
      // Browser history may restore an old DOM value even when React state already matches the URL.
      if (inputRef.current && inputRef.current.value !== canonicalMonth) {
        inputRef.current.value = canonicalMonth;
      }
      setSelectedMonth(canonicalMonth);
    };
    const afterHistoryRestoration = () => {
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
      pendingFrameRef.current = requestAnimationFrame(() => {
        pendingFrameRef.current = null;
        synchronizeFromUrl();
      });
    };

    window.addEventListener("pageshow", afterHistoryRestoration);
    window.addEventListener("popstate", afterHistoryRestoration);
    afterHistoryRestoration();

    return () => {
      window.removeEventListener("pageshow", afterHistoryRestoration);
      window.removeEventListener("popstate", afterHistoryRestoration);
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
    };
  }, [monthKey]);

  return (
    <form method="get" action={buildBusinessSetupHref(businessId)} autoComplete="off" className={styles.monthPicker}>
      <input type="hidden" name="step" value="month" />
      <label htmlFor="first-month-selection">انتقل مباشرة إلى شهر</label>
      <div className={styles.monthPickerControls}>
        <input
          ref={inputRef}
          id="first-month-selection"
          autoComplete="off"
          name="month"
          type="month"
          min="2000-01"
          max="2200-12"
          required
          value={selectedMonth}
          onChange={(event) => {
            if (pendingFrameRef.current !== null) {
              cancelAnimationFrame(pendingFrameRef.current);
              pendingFrameRef.current = null;
            }
            setSelectedMonth(event.currentTarget.value);
          }}
          aria-label="الشهر"
        />
        <button type="submit">فتح الشهر</button>
      </div>
    </form>
  );
}
