"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../lifetime-economics.module.css";

const COST_TYPES = [
  ["acquisition", "تكاليف الاكتساب"],
  ["variable_fulfillment", "تكاليف الوفاء المتغيرة المرتبطة بالعملاء"],
  ["other_variable", "تكاليف متغيرة أخرى مرتبطة بالعملاء"],
  ["payment_processing", "رسوم معالجة الدفع القابلة للتخصيص"],
] as const;

type CostType = (typeof COST_TYPES)[number][0];
type Method = "direct_actual" | "explicit_allocation";

type Cohort = {
  business_id: string;
  cohort_month: string;
  lifetime_net_cash_text: string;
  original_cohort_size: number | string;
  allocation_complete: boolean;
  lifetime_contribution_profit_text: string | null;
  currency: string | null;
};

type Allocation = {
  business_id: string;
  cohort_month: string;
  cost_type: CostType;
  amount_text: string;
  attribution_method: Method;
  note: string | null;
};

type Draft = Record<CostType, { amount: string; method: Method; note: string }>;

type Props = { businessId: string; baseCurrency: string; canManage: boolean };

function emptyDraft(): Draft {
  return {
    acquisition: { amount: "", method: "direct_actual", note: "" },
    variable_fulfillment: { amount: "", method: "direct_actual", note: "" },
    other_variable: { amount: "", method: "direct_actual", note: "" },
    payment_processing: { amount: "", method: "direct_actual", note: "" },
  };
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

const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function LifetimeContributionAllocationManager({ businessId, baseCurrency, canManage }: Props) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCohort, setSavingCohort] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const [cohortResult, allocationResult] = await Promise.all([
      supabase
        .from("customer_lifetime_contribution_profit_display")
        .select(
          "business_id,cohort_month,lifetime_net_cash_text,original_cohort_size,allocation_complete,lifetime_contribution_profit_text,currency",
        )
        .eq("business_id", businessId)
        .order("cohort_month", { ascending: false }),
      supabase
        .from("customer_cohort_cost_allocation_display")
        .select("business_id,cohort_month,cost_type,amount_text,attribution_method,note")
        .eq("business_id", businessId),
    ]);

    if (cohortResult.error || allocationResult.error) {
      setCohorts([]);
      setDrafts({});
      setError("تعذر تحميل الكوهورتات أو تخصيصات التكلفة. أعد المحاولة.");
      setIsLoading(false);
      return;
    }

    const loadedCohorts = (cohortResult.data ?? []) as Cohort[];
    const loadedAllocations = (allocationResult.data ?? []) as Allocation[];
    const nextDrafts: Record<string, Draft> = {};
    for (const cohort of loadedCohorts) nextDrafts[cohort.cohort_month] = emptyDraft();
    for (const allocation of loadedAllocations) {
      const draft = nextDrafts[allocation.cohort_month];
      if (!draft) continue;
      draft[allocation.cost_type] = {
        amount: allocation.amount_text,
        method: allocation.attribution_method,
        note: allocation.note ?? "",
      };
    }
    setCohorts(loadedCohorts);
    setDrafts(nextDrafts);
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invalidCohorts = useMemo(
    () =>
      new Set(
        Object.entries(drafts)
          .filter(([, draft]) => COST_TYPES.some(([type]) => !NON_NEGATIVE_DECIMAL.test(draft[type].amount)))
          .map(([cohortMonth]) => cohortMonth),
      ),
    [drafts],
  );

  const updateDraft = (
    cohortMonth: string,
    costType: CostType,
    patch: Partial<Draft[CostType]>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [cohortMonth]: {
        ...(current[cohortMonth] ?? emptyDraft()),
        [costType]: {
          ...(current[cohortMonth]?.[costType] ?? emptyDraft()[costType]),
          ...patch,
        },
      },
    }));
  };

  const save = async (cohortMonth: string) => {
    if (!canManage || savingCohort || invalidCohorts.has(cohortMonth)) return;
    const draft = drafts[cohortMonth];
    if (!draft) return;

    setSavingCohort(cohortMonth);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const allocations = COST_TYPES.map(([costType]) => ({
      cost_type: costType,
      amount: draft[costType].amount,
      attribution_method: draft[costType].method,
      note: draft[costType].note.trim() || null,
    }));
    const { error: saveError } = await supabase.rpc("save_customer_cohort_cost_allocations", {
      p_business_id: businessId,
      p_cohort_month: cohortMonth,
      p_allocations: allocations,
    });
    if (saveError) {
      setError("تعذر حفظ التكاليف المرتبطة بالكوهورت. راجع القيم والصلاحيات ثم أعد المحاولة.");
    } else {
      await load();
    }
    setSavingCohort(null);
  };

  if (isLoading) return <section className={styles.managerPanel}>جاري تحميل كوهورتات العملاء…</section>;

  return (
    <section className={styles.managerPanel} aria-labelledby="allocation-manager-title">
      <div className={styles.managerHeader}>
        <div>
          <h2 id="allocation-manager-title">تخصيص التكاليف لكل كوهورت</h2>
          <p>
            اكتب صفرًا إذا كنت تؤكد عدم وجود تكلفة من نوع معين. إذا كانت أي خانة غير محددة، يبقى ربح المساهمة غير متاح بدل التخمين.
          </p>
        </div>
      </div>

      {!canManage && <div className={styles.notice}>يمكنك عرض القيم فقط. الحفظ متاح لمالك البزنس أو الأدمن.</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {cohorts.map((cohort) => {
        const draft = drafts[cohort.cohort_month] ?? emptyDraft();
        const currency = cohort.currency ?? baseCurrency;
        return (
          <article className={styles.cohortCard} key={cohort.cohort_month}>
            <div className={styles.cohortHeader}>
              <div>
                <h3>{cohortLabel(cohort.cohort_month)}</h3>
                <span dir="ltr">{cohort.cohort_month}</span>
              </div>
              <div>
                <span>صافي التحصيل المحقق</span>
                <strong dir="ltr">{cohort.lifetime_net_cash_text} {currency}</strong>
              </div>
              <div>
                <span>ربح المساهمة الحالي</span>
                <strong dir="ltr">
                  {cohort.allocation_complete && cohort.lifetime_contribution_profit_text !== null
                    ? `${cohort.lifetime_contribution_profit_text} ${currency}`
                    : "غير متاح"}
                </strong>
              </div>
            </div>

            <div className={styles.allocationGrid}>
              {COST_TYPES.map(([costType, label]) => (
                <div className={styles.allocationRow} key={costType}>
                  <label>
                    <span>{label}</span>
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      value={draft[costType].amount}
                      disabled={!canManage || savingCohort === cohort.cohort_month}
                      onChange={(event) => updateDraft(cohort.cohort_month, costType, { amount: event.currentTarget.value.trim() })}
                      aria-label={`${label} ${cohort.cohort_month}`}
                    />
                  </label>
                  <label>
                    <span>طريقة التخصيص</span>
                    <select
                      value={draft[costType].method}
                      disabled={!canManage || savingCohort === cohort.cohort_month}
                      onChange={(event) =>
                        updateDraft(cohort.cohort_month, costType, { method: event.currentTarget.value as Method })
                      }
                      aria-label={`طريقة تخصيص ${label} ${cohort.cohort_month}`}
                    >
                      <option value="direct_actual">تكلفة فعلية مباشرة</option>
                      <option value="explicit_allocation">توزيع يدوي صريح</option>
                    </select>
                  </label>
                  <label className={styles.noteField}>
                    <span>ملاحظة — اختياري</span>
                    <input
                      value={draft[costType].note}
                      maxLength={500}
                      disabled={!canManage || savingCohort === cohort.cohort_month}
                      onChange={(event) => updateDraft(cohort.cohort_month, costType, { note: event.currentTarget.value })}
                      aria-label={`ملاحظة ${label} ${cohort.cohort_month}`}
                    />
                  </label>
                </div>
              ))}
            </div>

            {invalidCohorts.has(cohort.cohort_month) && (
              <div className={styles.error}>أدخل قيمة رقمية غير سالبة في الخانات الأربع. الصفر مسموح.</div>
            )}
            <button
              type="button"
              disabled={!canManage || invalidCohorts.has(cohort.cohort_month) || savingCohort === cohort.cohort_month}
              onClick={() => void save(cohort.cohort_month)}
            >
              {savingCohort === cohort.cohort_month ? "جاري الحفظ…" : "حفظ تكاليف الكوهورت"}
            </button>
          </article>
        );
      })}

      {cohorts.length === 0 && <div className={styles.notice}>لا توجد كوهورتات مكتسبة بعد.</div>}
    </section>
  );
}
