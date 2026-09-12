"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./customer-groups.module.css";
import profitStyles from "./customer-profitability.module.css";

type QualityState = "actual" | "estimated" | "incomplete";

type LifetimeContributionRow = {
  business_id: string;
  cohort_month: string;
  observation_cutoff_date: string;
  original_cohort_size: number | string;
  lifetime_net_cash_text: string;
  acquisition_costs_text: string;
  variable_fulfillment_costs_text: string;
  other_variable_costs_text: string;
  variable_financial_costs_text: string;
  lifetime_attributable_costs_text: string;
  lifetime_contribution_profit_text: string | null;
  lifetime_contribution_profit_per_customer_text: string | null;
  currency: string | null;
  quality_state: QualityState;
  transaction_history_complete: boolean;
  missing_relevant_period_count: number | string;
  incomplete_relevant_period_count: number | string;
  estimated_relevant_period_count: number | string;
  legacy_manual_allocation_count: number | string;
  uses_automatic_allocation: boolean;
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

/** Returns the founder-facing quality label for one first-purchase month. */
function qualityLabel(state: QualityState) {
  if (state === "actual") return "فعلي";
  if (state === "estimated") return "تقديري";
  return "غير مكتمل";
}

/** Explains why a row is incomplete without exposing internal allocation jargon. */
function incompleteReasons(row: LifetimeContributionRow) {
  const reasons: string[] = [];
  if (!row.transaction_history_complete) reasons.push("سجل معاملات العملاء غير مكتمل.");
  if (Number(row.missing_relevant_period_count) > 0) {
    reasons.push("يوجد نشاط لعملاء في شهر لا توجد له بيانات مالية شهرية مكتملة.");
  }
  if (Number(row.incomplete_relevant_period_count) > 0) {
    reasons.push("توجد تكلفة أو بيانات شهرية لم يكتمل توزيعها بأمان.");
  }
  if (Number(row.legacy_manual_allocation_count) > 0) {
    reasons.push("توجد توزيعات يدوية قديمة محفوظة للمراجعة ولم تدخل تلقائيًا في الربحية.");
  }
  if (reasons.length === 0) reasons.push("توجد بيانات لازمة لم تكتمل بعد، لذلك لا يعرض ميزان ربحًا نهائيًا.");
  return reasons;
}

/** Explains the provenance of a completed profitability result in founder language. */
function completedQualityExplanation(row: LifetimeContributionRow) {
  if (row.quality_state === "actual") {
    return "القيمة مبنية على بيانات مكتملة، ولا توجد تكلفة مؤهلة احتاجت إلى توزيع تقديري.";
  }
  return "المعاملات مكتملة، وميزان وزّع بعض التكاليف تلقائيًا بقواعد ثابتة مثل العملاء الجدد أو العملاء الدافعين أو التحصيل الإيجابي.";
}

/** Renders automatic Customer Profitability by first-purchase month with calculation details on demand. */
export function LifetimeContributionTable({ businessId, baseCurrency }: Props) {
  const [rows, setRows] = useState<LifetimeContributionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads the authorized automatic lifetime-profitability rows for the selected business. */
  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: loadError } = await supabase
      .from("customer_lifetime_contribution_profit_display")
      .select(
        "business_id,cohort_month,observation_cutoff_date,original_cohort_size,lifetime_net_cash_text,acquisition_costs_text,variable_fulfillment_costs_text,other_variable_costs_text,variable_financial_costs_text,lifetime_attributable_costs_text,lifetime_contribution_profit_text,lifetime_contribution_profit_per_customer_text,currency,quality_state,transaction_history_complete,missing_relevant_period_count,incomplete_relevant_period_count,estimated_relevant_period_count,legacy_manual_allocation_count,uses_automatic_allocation",
      )
      .eq("business_id", businessId)
      .order("cohort_month", { ascending: false });

    if (loadError) {
      setRows([]);
      setError("تعذر تحميل ربحية العملاء. حاول مرة أخرى.");
    } else {
      setRows((data ?? []) as LifetimeContributionRow[]);
    }
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (isLoading) {
    return <section className={styles.statusPanel}>جاري حساب ربحية العملاء…</section>;
  }

  if (error) {
    return (
      <section className={styles.errorPanel} role="alert">
        <strong>تعذر تحميل ربحية العملاء</strong>
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
        <span>يبدأ الحساب تلقائيًا بعد وجود سجل معاملات وبيانات شهرية فعلية.</span>
      </section>
    );
  }

  return (
    <section className={styles.groupPanel} aria-labelledby="customer-profitability-title">
      <div className={styles.groupHeading}>
        <div>
          <span className={styles.kicker}>Lifetime Contribution Profit / الربح المحقق من العميل حتى الآن</span>
          <h2 id="customer-profitability-title">كم حقق عملاء كل شهر بعد التكاليف المرتبطة بهم؟</h2>
          <p>
            ميزان يحسب الربحية تلقائيًا من صافي التحصيل وتكاليف الاكتساب والتكاليف المتغيرة المرتبطة بالعميل. المصروفات الشهرية الثابتة غير المرتبطة بالعميل تبقى في Real Net Profit ولا تخصم هنا.
          </p>
        </div>
      </div>

      <div className={`${styles.tableShell} ${profitStyles.desktopTable}`}>
        <table className={`${styles.groupsTable} ${profitStyles.profitTable}`} aria-label="ربحية العملاء حسب شهر أول شراء">
          <thead>
            <tr>
              <th scope="col">شهر أول شراء</th>
              <th scope="col">العملاء</th>
              <th scope="col">قيمة العميل المحققة</th>
              <th scope="col">الربح المحقق لكل عميل</th>
              <th scope="col">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currency = row.currency ?? baseCurrency;
              const incomplete = row.quality_state === "incomplete";
              const reasons = incompleteReasons(row);
              return (
                <tr key={`${row.business_id}:${row.cohort_month}`}>
                  <td>
                    <strong>{firstPurchaseMonthLabel(row.cohort_month)}</strong>
                    <small dir="ltr">{row.cohort_month}</small>
                  </td>
                  <td dir="ltr">{formatCountText(row.original_cohort_size)}</td>
                  <td dir="ltr">
                    <strong>{money(row.lifetime_net_cash_text, currency)}</strong>
                    <small dir="rtl">صافي ما دفعته هذه المجموعة حتى الآن</small>
                  </td>
                  <td>
                    {incomplete ? (
                      <span>غير متاح حتى تكتمل البيانات</span>
                    ) : (
                      <strong>{profitabilityResult(row.lifetime_contribution_profit_per_customer_text, currency)}</strong>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${profitStyles.qualityBadge} ${
                        row.quality_state === "actual"
                          ? profitStyles.qualityActual
                          : row.quality_state === "estimated"
                            ? profitStyles.qualityEstimated
                            : profitStyles.qualityIncomplete
                      }`}
                    >
                      {qualityLabel(row.quality_state)}
                    </span>
                    <details className={profitStyles.calculationDetails}>
                      <summary>عرض طريقة الحساب</summary>
                      <div className={profitStyles.detailBody}>
                        <p className={profitStyles.qualityExplanation}>
                          {incomplete ? reasons.join(" ") : completedQualityExplanation(row)}
                        </p>
                        <dl className={profitStyles.calculationList}>
                          <div>
                            <dt>صافي التحصيل المحقق</dt>
                            <dd dir="ltr">{money(row.lifetime_net_cash_text, currency)}</dd>
                          </div>
                          <div>
                            <dt>تكاليف الاكتساب الموزعة</dt>
                            <dd dir="ltr">{money(row.acquisition_costs_text, currency)}</dd>
                          </div>
                          <div>
                            <dt>تكاليف خدمة العميل المتغيرة</dt>
                            <dd dir="ltr">{money(row.variable_fulfillment_costs_text, currency)}</dd>
                          </div>
                          <div>
                            <dt>تكاليف أخرى مرتبطة بالعميل</dt>
                            <dd dir="ltr">{money(row.other_variable_costs_text, currency)}</dd>
                          </div>
                          <div>
                            <dt>التكاليف المالية المتغيرة</dt>
                            <dd dir="ltr">{money(row.variable_financial_costs_text, currency)}</dd>
                          </div>
                          <div className={profitStyles.totalRow}>
                            <dt>إجمالي التكاليف المرتبطة بالعميل</dt>
                            <dd dir="ltr">{money(row.lifetime_attributable_costs_text, currency)}</dd>
                          </div>
                          <div className={profitStyles.resultRow}>
                            <dt>الربح المحقق للمجموعة حتى الآن</dt>
                            <dd dir="ltr">
                              {incomplete
                                ? "—"
                                : profitabilityResult(row.lifetime_contribution_profit_text, currency)}
                            </dd>
                          </div>
                        </dl>
                        {row.uses_automatic_allocation && !incomplete && (
                          <small>تم توزيع التكاليف المؤهلة تلقائيًا؛ لا تحتاج إلى إدخال توزيع شهري يدوي.</small>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className={profitStyles.mobileList} aria-label="ربحية العملاء حسب شهر أول شراء — عرض الهاتف">
        {rows.map((row) => {
          const currency = row.currency ?? baseCurrency;
          const incomplete = row.quality_state === "incomplete";
          const reasons = incompleteReasons(row);
          return (
            <article className={profitStyles.mobileCard} key={`mobile:${row.business_id}:${row.cohort_month}`}>
              <div className={profitStyles.mobileHeader}>
                <div>
                  <span>شهر أول شراء</span>
                  <strong>{firstPurchaseMonthLabel(row.cohort_month)}</strong>
                </div>
                <span
                  className={`${profitStyles.qualityBadge} ${
                    row.quality_state === "actual"
                      ? profitStyles.qualityActual
                      : row.quality_state === "estimated"
                        ? profitStyles.qualityEstimated
                        : profitStyles.qualityIncomplete
                  }`}
                >
                  {qualityLabel(row.quality_state)}
                </span>
              </div>
              <dl className={profitStyles.mobileMetrics}>
                <div>
                  <dt>العملاء</dt>
                  <dd dir="ltr">{formatCountText(row.original_cohort_size)}</dd>
                </div>
                <div>
                  <dt>قيمة العميل المحققة</dt>
                  <dd dir="ltr">{money(row.lifetime_net_cash_text, currency)}</dd>
                </div>
                <div className={profitStyles.mobilePrimaryMetric}>
                  <dt>الربح المحقق لكل عميل</dt>
                  <dd>
                    {incomplete
                      ? "غير متاح حتى تكتمل البيانات"
                      : profitabilityResult(row.lifetime_contribution_profit_per_customer_text, currency)}
                  </dd>
                </div>
              </dl>
              <details className={profitStyles.calculationDetails}>
                <summary>عرض طريقة الحساب</summary>
                <div className={profitStyles.detailBody}>
                  <p className={profitStyles.qualityExplanation}>
                    {incomplete ? reasons.join(" ") : completedQualityExplanation(row)}
                  </p>
                  <dl className={profitStyles.calculationList}>
                    <div>
                      <dt>صافي التحصيل المحقق</dt>
                      <dd dir="ltr">{money(row.lifetime_net_cash_text, currency)}</dd>
                    </div>
                    <div>
                      <dt>تكاليف الاكتساب الموزعة</dt>
                      <dd dir="ltr">{money(row.acquisition_costs_text, currency)}</dd>
                    </div>
                    <div>
                      <dt>تكاليف خدمة العميل المتغيرة</dt>
                      <dd dir="ltr">{money(row.variable_fulfillment_costs_text, currency)}</dd>
                    </div>
                    <div>
                      <dt>تكاليف أخرى مرتبطة بالعميل</dt>
                      <dd dir="ltr">{money(row.other_variable_costs_text, currency)}</dd>
                    </div>
                    <div>
                      <dt>التكاليف المالية المتغيرة</dt>
                      <dd dir="ltr">{money(row.variable_financial_costs_text, currency)}</dd>
                    </div>
                    <div className={profitStyles.totalRow}>
                      <dt>إجمالي التكاليف المرتبطة بالعميل</dt>
                      <dd dir="ltr">{money(row.lifetime_attributable_costs_text, currency)}</dd>
                    </div>
                    <div className={profitStyles.resultRow}>
                      <dt>الربح المحقق للمجموعة حتى الآن</dt>
                      <dd dir="ltr">
                        {incomplete ? "—" : profitabilityResult(row.lifetime_contribution_profit_text, currency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </details>
            </article>
          );
        })}
      </section>
    </section>
  );
}
