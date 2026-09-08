"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
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

/** Formats an optional exact money value while preserving unavailable values as an em dash. */
function money(value: string | null, currency: string) {
  return value === null ? "—" : formatMoneyText(value, currency);
}

/** Converts a stored acquisition month into a founder-facing Arabic first-purchase month label. */
function firstPurchaseMonthLabel(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Presents an exact signed result as profit, break-even, or loss without calling a negative value profit. */
function profitabilityResult(value: string | null, currency: string) {
  if (value === null) return "—";
  const exact = value.trim();
  const hasNonZeroDigit = /[1-9]/.test(exact);
  if (exact.startsWith("-") && hasNonZeroDigit) {
    return `خسارة ${formatMoneyText(exact.slice(1), currency)}`;
  }
  if (!hasNonZeroDigit) return `تعادل ${formatMoneyText(exact, currency)}`;
  return `ربح ${formatMoneyText(exact, currency)}`;
}

/** Renders customer-group Lifetime Contribution Profit without including fixed monthly overhead. */
export function LifetimeContributionTable({ businessId, baseCurrency }: Props) {
  const [rows, setRows] = useState<LifetimeContributionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads the authorized lifetime-profitability rows for the selected business. */
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
      setError("تعذر تحميل ربحية العملاء بعد التكاليف. حاول مرة أخرى.");
    } else {
      setRows((data ?? []) as LifetimeContributionRow[]);
    }
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (isLoading) {
    return <section className={styles.statusPanel}>جاري حساب ربحية العملاء بعد التكاليف…</section>;
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل ربحية العملاء بعد التكاليف</strong>
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
        <strong>لا توجد مجموعات عملاء مكتسبة لحساب الربحية بعد.</strong>
        <span>يبدأ الحساب بعد وجود سجل معاملات واكتساب عملاء فعلي.</span>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="lifetime-contribution-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>بعد التكاليف المرتبطة بالعميل</span>
          <h2 id="lifetime-contribution-title">ربحية العملاء بعد التكاليف</h2>
          <p>
            Lifetime Contribution Profit = صافي التحصيل المحقق ناقص تكلفة الاكتساب والتكاليف المتغيرة المرتبطة بالعميل ورسوم الدفع القابلة للتخصيص. الرواتب الشهرية الثابتة والإيجار والإدارة وأي Fixed Monthly لا تدخل هنا.
          </p>
        </div>
        <Link className={styles.retryButton} href={`/businesses/${businessId}/customers/lifetime-contribution`}>
          مراجعة التكاليف المرتبطة
        </Link>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.groupsTable} aria-label="جدول ربحية العملاء بعد التكاليف">
          <thead>
            <tr>
              <th scope="col">شهر أول شراء</th>
              <th scope="col">العملاء</th>
              <th scope="col">صافي التحصيل حتى الآن</th>
              <th scope="col">التكاليف المؤهلة</th>
              <th scope="col">النتيجة بعد التكاليف</th>
              <th scope="col">النتيجة لكل عميل</th>
              <th scope="col">حالة التكاليف</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              return (
                <tr key={`${row.business_id}:${row.cohort_month}`}>
                  <td>
                    <strong>{firstPurchaseMonthLabel(row.cohort_month)}</strong>
                    <small dir="ltr">{row.cohort_month}</small>
                  </td>
                  <td dir="ltr">{formatCountText(row.original_cohort_size)}</td>
                  <td dir="ltr">{money(row.lifetime_net_cash_text, currency)}</td>
                  <td dir="ltr">{row.allocation_complete ? money(row.attributable_costs_text, currency) : "—"}</td>
                  <td>
                    {row.allocation_complete ? (
                      <strong>{profitabilityResult(row.lifetime_contribution_profit_text, currency)}</strong>
                    ) : (
                      <span>تحتاج مراجعة التكاليف</span>
                    )}
                  </td>
                  <td>
                    {row.allocation_complete
                      ? profitabilityResult(row.lifetime_contribution_profit_per_customer_text, currency)
                      : "—"}
                  </td>
                  <td>
                    {row.allocation_complete
                      ? row.uses_explicit_allocation
                        ? "مراجَعة — تتضمن توزيعًا تقديريًا صريحًا"
                        : "مراجَعة — تكاليف مرتبطة مباشرة"
                      : "راجع أهلية التكاليف قبل اعتماد النتيجة"}
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
