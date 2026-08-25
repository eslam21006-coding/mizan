"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";

const PAGE_SIZE = 50;

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

function exactDisplay(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function moneyDisplay(value: string, currency: string) {
  return `${value} ${currency}`;
}

function cohortLabel(value: string) {
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

export function CustomerCohortLtvTable({ businessId, baseCurrency }: CustomerCohortLtvTableProps) {
  const [rows, setRows] = useState<CustomerObservedLtv[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
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

      if (!active) return;
      if (loadError) {
        setRows([]);
        setTotalCount(null);
        setError("تعذر تحميل كوهورتات العملاء وObserved LTV. لم يتم تغيير أي بيانات.");
      } else {
        setRows((data ?? []) as CustomerObservedLtv[]);
        setTotalCount(count ?? null);
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [businessId, page]);

  const pageCount = useMemo(() => {
    if (totalCount === null) return null;
    return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }, [totalCount]);

  if (isLoading) {
    return (
      <section className={styles.statusPanel} role="status" aria-live="polite">
        جاري حساب الكوهورتات وقيمة العميل المحققة…
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل Observed LTV</strong>
        <p>{error}</p>
      </section>
    );
  }

  if (rows.length === 0 && page === 0) {
    return (
      <section className={styles.emptyPanel}>
        <span>لا توجد كوهورتات مكتسبة بعد</span>
        <h2>Observed LTV يحتاج عملاء لديهم Collection ناجحة</h2>
        <p>
          بعد وجود أول Collection ناجحة للعميل، يثبت شهر اكتسابه داخل كوهورت ويبدأ Mizan في تتبع القيمة المحققة
          حتى الآن من سجل المعاملات.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="observed-ltv-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>Customer Economics</span>
          <h2 id="observed-ltv-title">Observed LTV / قيمة العميل المحققة حتى الآن</h2>
          <p>
            قيمة محققة من سجل المعاملات حتى تاريخ الملاحظة، وليست توقعًا للقيمة النهائية للعميل. الكوهورت الصغير
            في العمر لا يُعامل كأنه أكمل Lifetime كاملًا.
          </p>
        </div>
        <div className={styles.identityCount}>
          <span>الكوهورتات</span>
          <strong>{totalCount ?? rows.length}</strong>
        </div>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول الكوهورتات وObserved LTV">
          <thead>
            <tr>
              <th scope="col">الكوهورت</th>
              <th scope="col">العملاء الأصليون</th>
              <th scope="col">Gross Cash تراكمي</th>
              <th scope="col">Refunds تراكمية</th>
              <th scope="col">Net Cash تراكمي</th>
              <th scope="col">Observed LTV</th>
              <th scope="col">النضج</th>
              <th scope="col">حتى</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              return (
                <tr key={`${row.business_id}:${row.cohort_month}`}>
                  <td>
                    <strong>{cohortLabel(row.cohort_month)}</strong>
                    <small dir="ltr">{row.cohort_month}</small>
                  </td>
                  <td dir="ltr">{exactDisplay(row.original_cohort_size)}</td>
                  <td dir="ltr">{moneyDisplay(row.cumulative_gross_cash_collected_text, currency)}</td>
                  <td dir="ltr">{moneyDisplay(row.cumulative_refunds_text, currency)}</td>
                  <td dir="ltr">
                    <strong>{moneyDisplay(row.cumulative_net_cash_collected_text, currency)}</strong>
                  </td>
                  <td dir="ltr">
                    <strong>{moneyDisplay(row.observed_ltv_text, currency)}</strong>
                  </td>
                  <td>
                    <strong dir="ltr">M{exactDisplay(row.cohort_age_months)}</strong>
                    <small>{exactDisplay(row.months_observed)} شهرًا مُلاحظًا</small>
                  </td>
                  <td dir="ltr">{row.observation_cutoff_date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="التنقل بين صفحات الكوهورتات">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          الصفحة السابقة
        </button>
        <span>
          الصفحة {page + 1}
          {pageCount !== null ? ` من ${pageCount}` : ""}
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
