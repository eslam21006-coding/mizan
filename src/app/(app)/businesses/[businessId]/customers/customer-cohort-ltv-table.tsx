"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";

const PAGE_SIZE = 12;

type CustomerObservedLtv = {
  business_id: string;
  cohort_month: string;
  observation_month: string;
  observation_cutoff_date: string;
  original_cohort_size: number | string;
  cumulative_gross_cash_collected_text: string;
  cumulative_refunds_text: string;
  cumulative_net_cash_collected_text: string;
  observed_ltv_text: string;
  cohort_age_months: number | string;
  months_observed: number | string;
  currency: string | null;
};

type CustomerCohortLtvTableProps = {
  businessId: string;
  baseCurrency: string;
};

/** Converts a stored acquisition-group month into a founder-facing Arabic month label. */
function acquisitionMonthLabel(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;

  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Converts months since first purchase into concise Arabic founder-facing wording. */
function elapsedSinceFirstPurchaseLabel(value: number | string) {
  const age = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(age) || age < 0) return String(value);
  if (age === 0) return "في شهر أول شراء";
  if (age === 1) return "بعد شهر";
  if (age === 2) return "بعد شهرين";
  if (age >= 3 && age <= 10) return `بعد ${formatCountText(age)} أشهر`;
  return `بعد ${formatCountText(age)} شهرًا`;
}

/** Shows one year of first-purchase customer groups per page with plain labels and rounded display values. */
export function CustomerCohortLtvTable({ businessId, baseCurrency }: CustomerCohortLtvTableProps) {
  const [rows, setRows] = useState<CustomerObservedLtv[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads the current first-purchase-month page and ignores stale responses after the caller becomes inactive. */
  const loadRows = useCallback(
    async (isActive: () => boolean = () => true) => {
      setIsLoading(true);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: loadError, count } = await supabase
        .from("customer_observed_ltv")
        .select(
          "business_id,cohort_month,observation_month,observation_cutoff_date,original_cohort_size,cumulative_gross_cash_collected_text,cumulative_refunds_text,cumulative_net_cash_collected_text,observed_ltv_text,cohort_age_months,months_observed,currency",
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("cohort_month", { ascending: false })
        .range(from, to);

      if (!isActive()) return;
      if (loadError) {
        setRows([]);
        setTotalCount(null);
        setError("تعذر تحميل مجموعات العملاء حسب شهر أول شراء وقيمة العميل المحققة. حاول مرة أخرى.");
      } else {
        setRows((data ?? []) as CustomerObservedLtv[]);
        setTotalCount(count ?? null);
      }
      setIsLoading(false);
    },
    [businessId, page],
  );

  useEffect(() => {
    let active = true;
    void loadRows(() => active);
    return () => {
      active = false;
    };
  }, [loadRows]);

  const pageCount = useMemo(() => {
    if (totalCount === null) return null;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  if (isLoading) {
    return (
      <section className={styles.statusPanel} role="status" aria-live="polite">
        جاري حساب قيمة العميل المحققة…
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل قيمة العميل المحققة</strong>
        <p>{error}</p>
        <button className={styles.retryButton} type="button" onClick={() => void loadRows()}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (rows.length === 0 && page === 0) {
    return (
      <section className={styles.compactEmptyPanel}>
        <strong>لا توجد مجموعات عملاء حسب شهر أول شراء بعد.</strong>
        <span>ستظهر هنا بعد وجود أول تحصيل ناجح لعميل واحد على الأقل.</span>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="observed-ltv-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>Observed LTV / قيمة العميل المحققة حتى الآن</span>
          <h2 id="observed-ltv-title">كم دفع عملاء كل شهر حتى الآن؟</h2>
          <p>
            نقسم العملاء حسب شهر أول شراء فقط للمقارنة. مثال: صف أغسطس 2026 يعني كل العملاء الذين كان أول شراء لهم في أغسطس. قيمة العميل المحققة = صافي ما دفعته هذه المجموعة حتى تاريخ الملاحظة الظاهر في الصف ÷ عدد العملاء الذين بدأوا في ذلك الشهر. هذا رقم محقق من المعاملات الفعلية، وليس توقعًا للمستقبل.
          </p>
        </div>
        <div className={styles.identityCount}>
          <span>أشهر أول شراء</span>
          <strong>{formatCountText(totalCount ?? rows.length)}</strong>
        </div>
      </div>

      <div className={styles.tableShell}>
        <table className={`${styles.groupsTable} ${styles.ltvTable}`} aria-label="قيمة العميل حسب شهر أول شراء">
          <thead>
            <tr>
              <th scope="col">شهر أول شراء</th>
              <th scope="col">عدد العملاء</th>
              <th scope="col">مرّ منذ أول شراء</th>
              <th scope="col">صافي ما دفعته المجموعة</th>
              <th scope="col">متوسط قيمة العميل حتى الآن</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              return (
                <tr key={`${row.business_id}:${row.cohort_month}`}>
                  <td>
                    <strong>{acquisitionMonthLabel(row.cohort_month)}</strong>
                    <small dir="ltr">{row.cohort_month}</small>
                  </td>
                  <td dir="ltr">
                    <strong>{formatCountText(row.original_cohort_size)}</strong>
                    <small>بدأوا الشراء في هذا الشهر</small>
                  </td>
                  <td>
                    <strong>{elapsedSinceFirstPurchaseLabel(row.cohort_age_months)}</strong>
                    <small dir="ltr">حتى {row.observation_cutoff_date}</small>
                  </td>
                  <td dir="ltr">
                    <strong>{formatMoneyText(row.cumulative_net_cash_collected_text, currency)}</strong>
                    <small>
                      تحصيل {formatMoneyText(row.cumulative_gross_cash_collected_text, currency)} · استرجاع {formatMoneyText(row.cumulative_refunds_text, currency)}
                    </small>
                  </td>
                  <td dir="ltr">
                    <strong className={styles.primaryMetric}>{formatMoneyText(row.observed_ltv_text, currency)}</strong>
                    <small>لكل عميل بدأ في هذا الشهر</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="التنقل بين صفحات أشهر أول شراء">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          الصفحة السابقة
        </button>
        <span>
          الصفحة {formatCountText(page + 1)}
          {pageCount !== null ? ` من ${formatCountText(pageCount)}` : ""}
        </span>
        <button
          type="button"
          disabled={pageCount !== null ? page + 1 >= pageCount : rows.length < PAGE_SIZE}
          onClick={() => setPage((current) => current + 1)}
        >
          الصفحة التالية
        </button>
      </nav>
    </section>
  );
}
