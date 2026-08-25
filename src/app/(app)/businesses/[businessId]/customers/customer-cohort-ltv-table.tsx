"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
        setError("تعذر تحميل كوهورتات العملاء وقيمة العميل المحققة. حاول مرة أخرى. إذا استمرت المشكلة، تحقق من تطبيق تحديثات قاعدة البيانات الخاصة بالكوهورتات.");
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
        جاري حساب الكوهورتات وقيمة العميل المحققة…
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
        <strong>لا توجد كوهورتات مكتسبة بعد.</strong>
        <span>ستظهر هنا بعد وجود أول تحصيل ناجح لعميل واحد على الأقل.</span>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="observed-ltv-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>قيمة محققة من سجل المعاملات</span>
          <h2 id="observed-ltv-title">Observed LTV / قيمة العميل المحققة حتى الآن</h2>
          <p>قيمة محققة فعلًا من سجل المعاملات حتى تاريخ الملاحظة، وليست توقعًا للقيمة النهائية للعميل.</p>
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
              <th scope="col">إجمالي التحصيل التراكمي</th>
              <th scope="col">الاسترجاعات التراكمية</th>
              <th scope="col">صافي التحصيل التراكمي</th>
              <th scope="col">قيمة العميل المحققة</th>
              <th scope="col">عمر الكوهورت</th>
              <th scope="col">حتى تاريخ</th>
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
