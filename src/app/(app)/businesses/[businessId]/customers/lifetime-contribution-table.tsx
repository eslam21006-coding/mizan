"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";

type LifetimeContributionRow = {
  business_id: string;
  cohort_month: string;
  observation_cutoff_date: string;
  original_cohort_size: number | string;
  lifetime_net_cash_text: string;
  attributable_costs_text: string;
  acquisition_costs_text: string;
  variable_fulfillment_costs_text: string;
  other_variable_costs_text: string;
  payment_processing_costs_text: string;
  allocation_complete: boolean;
  uses_explicit_allocation: boolean;
  lifetime_contribution_profit_text: string | null;
  lifetime_contribution_profit_per_customer_text: string | null;
  currency: string | null;
};

type Props = {
  businessId: string;
  baseCurrency: string;
};

function money(value: string | null, currency: string) {
  return value === null ? "—" : `${value} ${currency}`;
}

function cohortLabel(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function LifetimeContributionTable({ businessId, baseCurrency }: Props) {
  const [rows, setRows] = useState<LifetimeContributionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: loadError } = await supabase
      .from("customer_lifetime_contribution_profit_display")
      .select(
        "business_id,cohort_month,observation_cutoff_date,original_cohort_size,lifetime_net_cash_text,attributable_costs_text,acquisition_costs_text,variable_fulfillment_costs_text,other_variable_costs_text,payment_processing_costs_text,allocation_complete,uses_explicit_allocation,lifetime_contribution_profit_text,lifetime_contribution_profit_per_customer_text,currency",
      )
      .eq("business_id", businessId)
      .order("cohort_month", { ascending: false });

    if (loadError) {
      setRows([]);
      setError("تعذر تحميل ربح المساهمة مدى الحياة. حاول مرة أخرى.");
    } else {
      setRows((data ?? []) as LifetimeContributionRow[]);
    }
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (isLoading) {
    return <section className={styles.statusPanel}>جاري حساب ربح المساهمة مدى الحياة…</section>;
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل ربح المساهمة مدى الحياة</strong>
        <p>{error}</p>
        <button className={styles.retryButton} type="button" onClick={() => void loadRows()}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className={styles.compactEmptyPanel}>
        <strong>لا توجد كوهورتات مكتسبة لحساب ربح المساهمة بعد.</strong>
        <span>يبدأ الحساب بعد وجود سجل معاملات واكتساب عملاء فعلي.</span>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="lifetime-contribution-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>اقتصاديات العميل بعد التكاليف المرتبطة به</span>
          <h2 id="lifetime-contribution-title">Lifetime Contribution Profit / ربح المساهمة مدى الحياة</h2>
          <p>
            صافي التحصيل المحقق ناقص تكاليف الاكتساب والوفاء المتغيرة والتكاليف المتغيرة الأخرى ورسوم الدفع القابلة للتخصيص. المصاريف العامة الثابتة غير داخلة في هذا المقياس.
          </p>
        </div>
        <Link className={styles.retryButton} href={`/businesses/${businessId}/customers/lifetime-contribution`}>
          إدخال التكاليف المرتبطة
        </Link>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول ربح المساهمة مدى الحياة">
          <thead>
            <tr>
              <th scope="col">الكوهورت</th>
              <th scope="col">صافي التحصيل مدى الحياة</th>
              <th scope="col">التكاليف المرتبطة</th>
              <th scope="col">ربح المساهمة</th>
              <th scope="col">لكل عميل أصلي</th>
              <th scope="col">جودة التخصيص</th>
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
                  <td dir="ltr">{money(row.lifetime_net_cash_text, currency)}</td>
                  <td dir="ltr">{row.allocation_complete ? money(row.attributable_costs_text, currency) : "—"}</td>
                  <td dir="ltr">
                    {row.allocation_complete ? (
                      <strong>{money(row.lifetime_contribution_profit_text, currency)}</strong>
                    ) : (
                      <span>غير متاح</span>
                    )}
                  </td>
                  <td dir="ltr">
                    {row.allocation_complete ? money(row.lifetime_contribution_profit_per_customer_text, currency) : "—"}
                  </td>
                  <td>
                    {row.allocation_complete
                      ? row.uses_explicit_allocation
                        ? "يتضمن توزيعًا يدويًا"
                        : "تكاليف مباشرة"
                      : "أكمل التكاليف الأربعة"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
