"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCountText, formatMoneyText } from "@/lib/financial-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "../lifetime-economics.module.css";

const COST_TYPES = [
  {
    type: "acquisition",
    label: "تكلفة اكتساب هؤلاء العملاء",
    guidance: "أدخل تكلفة الاكتساب المرتبطة فعلًا بهذه المجموعة، أو حصة واضحة ومقصودة من تكلفة اكتساب مشتركة.",
    confirmation: "أؤكد أن هذا المبلغ تكلفة اكتساب مرتبطة بهؤلاء العملاء، وليس مصروفًا عامًا غير منسوب لهم.",
  },
  {
    type: "variable_fulfillment",
    label: "تكاليف خدمة العميل المتغيرة",
    guidance: "فقط ما يزيد أو ينقص مع عدد العملاء أو الإيراد. لا تدخل راتبًا شهريًا ثابتًا أو إيجارًا أو أي Fixed Monthly.",
    confirmation: "أؤكد أن هذه التكلفة Per Customer أو % of Revenue وليست راتبًا شهريًا ثابتًا أو تكلفة Fixed Monthly.",
  },
  {
    type: "other_variable",
    label: "تكاليف أخرى تتغير مع العميل",
    guidance: "أي تكلفة أخرى مرتبطة بالعميل وتتغير مع عدد العملاء أو الإيراد. التكاليف الثابتة غير مؤهلة هنا.",
    confirmation: "أؤكد أن هذه تكلفة متغيرة مرتبطة بالعميل وليست تكلفة ثابتة شهرية.",
  },
  {
    type: "payment_processing",
    label: "رسوم بوابة الدفع القابلة للتخصيص",
    guidance: "رسوم معالجة الدفع التي يمكن ربطها بهذه المجموعة فقط. لا تدخل الضرائب أو تكاليف مالية ثابتة.",
    confirmation: "أؤكد أن هذا المبلغ رسوم معالجة دفع قابلة للتخصيص لهؤلاء العملاء.",
  },
] as const;

type CostType = (typeof COST_TYPES)[number]["type"];
type Method = "direct_actual" | "explicit_allocation";

type CustomerGroup = {
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
  eligibility_confirmed: boolean;
};

type Draft = Record<CostType, { amount: string; method: Method; note: string; confirmed: boolean }>;

type Props = { businessId: string; baseCurrency: string; canManage: boolean };

function emptyDraft(): Draft {
  return {
    acquisition: { amount: "", method: "direct_actual", note: "", confirmed: false },
    variable_fulfillment: { amount: "", method: "direct_actual", note: "", confirmed: false },
    other_variable: { amount: "", method: "direct_actual", note: "", confirmed: false },
    payment_processing: { amount: "", method: "direct_actual", note: "", confirmed: false },
  };
}

function firstPurchaseMonthLabel(value: string) {
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function isPositiveAmount(value: string) {
  return NON_NEGATIVE_DECIMAL.test(value) && /[1-9]/.test(value);
}

function contributionPresentation(value: string | null, currency: string) {
  if (value === null) {
    return { label: "النتيجة بعد التكاليف", value: "تحتاج مراجعة التكاليف" };
  }

  const exact = value.trim();
  const hasNonZeroDigit = /[1-9]/.test(exact);
  if (exact.startsWith("-") && hasNonZeroDigit) {
    return {
      label: "خسارة بعد التكاليف حتى الآن",
      value: formatMoneyText(exact.slice(1), currency),
    };
  }
  if (!hasNonZeroDigit) {
    return { label: "تعادل بعد التكاليف حتى الآن", value: formatMoneyText(exact, currency) };
  }
  return { label: "ربح بعد التكاليف حتى الآن", value: formatMoneyText(exact, currency) };
}

export function LifetimeContributionAllocationManager({ businessId, baseCurrency, canManage }: Props) {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const [groupResult, allocationResult] = await Promise.all([
      supabase
        .from("customer_lifetime_contribution_profit_display")
        .select(
          "business_id,cohort_month,lifetime_net_cash_text,original_cohort_size,allocation_complete,lifetime_contribution_profit_text,currency",
        )
        .eq("business_id", businessId)
        .order("cohort_month", { ascending: false }),
      supabase
        .from("customer_cohort_cost_allocation_display")
        .select("business_id,cohort_month,cost_type,amount_text,attribution_method,note,eligibility_confirmed")
        .eq("business_id", businessId),
    ]);

    if (groupResult.error || allocationResult.error) {
      setGroups([]);
      setDrafts({});
      setError("تعذر تحميل مجموعات العملاء أو التكاليف المرتبطة بها. أعد المحاولة.");
      setIsLoading(false);
      return;
    }

    const loadedGroups = (groupResult.data ?? []) as CustomerGroup[];
    const loadedAllocations = (allocationResult.data ?? []) as Allocation[];
    const nextDrafts: Record<string, Draft> = {};
    for (const group of loadedGroups) nextDrafts[group.cohort_month] = emptyDraft();
    for (const allocation of loadedAllocations) {
      const draft = nextDrafts[allocation.cohort_month];
      if (!draft) continue;
      draft[allocation.cost_type] = {
        amount: allocation.amount_text,
        method: allocation.attribution_method,
        note: allocation.note ?? "",
        confirmed: allocation.eligibility_confirmed,
      };
    }
    setGroups(loadedGroups);
    setDrafts(nextDrafts);
    setIsLoading(false);
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invalidGroups = useMemo(
    () =>
      new Set(
        Object.entries(drafts)
          .filter(([, draft]) => COST_TYPES.some(({ type }) => !NON_NEGATIVE_DECIMAL.test(draft[type].amount)))
          .map(([groupMonth]) => groupMonth),
      ),
    [drafts],
  );

  const unconfirmedPositiveGroups = useMemo(
    () =>
      new Set(
        Object.entries(drafts)
          .filter(([, draft]) =>
            COST_TYPES.some(({ type }) => isPositiveAmount(draft[type].amount) && !draft[type].confirmed),
          )
          .map(([groupMonth]) => groupMonth),
      ),
    [drafts],
  );

  const touchedGroups = useMemo(
    () =>
      new Set(
        Object.entries(drafts)
          .filter(([, draft]) => COST_TYPES.some(({ type }) => draft[type].amount !== ""))
          .map(([groupMonth]) => groupMonth),
      ),
    [drafts],
  );

  const updateDraft = (
    groupMonth: string,
    costType: CostType,
    patch: Partial<Draft[CostType]>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [groupMonth]: {
        ...(current[groupMonth] ?? emptyDraft()),
        [costType]: {
          ...(current[groupMonth]?.[costType] ?? emptyDraft()[costType]),
          ...patch,
        },
      },
    }));
  };

  const save = async (groupMonth: string) => {
    if (
      !canManage ||
      savingGroup ||
      invalidGroups.has(groupMonth) ||
      unconfirmedPositiveGroups.has(groupMonth)
    ) {
      return;
    }
    const draft = drafts[groupMonth];
    if (!draft) return;

    setSavingGroup(groupMonth);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const allocations = COST_TYPES.map(({ type }) => ({
      cost_type: type,
      amount: draft[type].amount,
      attribution_method: draft[type].method,
      note: draft[type].note.trim() || null,
      eligibility_confirmed: draft[type].confirmed,
    }));
    const { error: saveError } = await supabase.rpc("save_customer_cohort_cost_allocations", {
      p_business_id: businessId,
      p_cohort_month: groupMonth,
      p_allocations: allocations,
    });
    if (saveError) {
      setError("تعذر حفظ التكاليف بعد المراجعة. راجع القيم وتأكيدات الأهلية والصلاحيات ثم أعد المحاولة.");
    } else {
      await load();
    }
    setSavingGroup(null);
  };

  if (isLoading) return <section className={styles.managerPanel}>جاري تحميل مجموعات العملاء…</section>;

  return (
    <section className={styles.managerPanel} aria-labelledby="allocation-manager-title">
      <div className={styles.managerHeader}>
        <div>
          <h2 id="allocation-manager-title">راجع التكاليف حسب شهر أول شراء</h2>
          <p>
            كل مجموعة هنا تعني العملاء الذين بدأوا الشراء في نفس الشهر. اكتب صفرًا فقط عندما تتأكد أن هذا النوع من التكلفة غير موجود. أي مبلغ موجب يحتاج تأكيدًا صريحًا قبل أن يدخل في النتيجة.
          </p>
        </div>
      </div>

      <div className={styles.notice}>
        <strong>مهم:</strong> الرواتب الشهرية الثابتة، الإيجار، الإدارة، والـ Fixed Monthly لا تخصم هنا حتى لو كانت ضمن Fulfillment. هذه التكاليف تدخل في Real Net Profit، وليست من التكاليف المتغيرة للعميل.
      </div>

      {!canManage && <div className={styles.notice}>يمكنك عرض القيم فقط. الحفظ متاح لمالك البزنس أو الأدمن.</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {groups.map((group) => {
        const draft = drafts[group.cohort_month] ?? emptyDraft();
        const currency = group.currency ?? baseCurrency;
        const result = contributionPresentation(
          group.allocation_complete ? group.lifetime_contribution_profit_text : null,
          currency,
        );
        return (
          <article className={styles.cohortCard} key={group.cohort_month}>
            <div className={styles.cohortHeader}>
              <div>
                <h3>{firstPurchaseMonthLabel(group.cohort_month)}</h3>
                <span>شهر أول شراء</span>
                <span dir="ltr">{group.cohort_month}</span>
              </div>
              <div>
                <span>عدد العملاء عند بداية المجموعة</span>
                <strong dir="ltr">{formatCountText(group.original_cohort_size)}</strong>
              </div>
              <div>
                <span>صافي التحصيل المحقق</span>
                <strong dir="ltr">{formatMoneyText(group.lifetime_net_cash_text, currency)}</strong>
              </div>
              <div>
                <span>{result.label}</span>
                <strong dir="ltr">{result.value}</strong>
              </div>
            </div>

            <div className={styles.allocationGrid}>
              {COST_TYPES.map(({ type: costType, label, guidance, confirmation }) => {
                const positive = isPositiveAmount(draft[costType].amount);
                return (
                  <div className={styles.costBlock} key={costType}>
                    <div className={styles.allocationRow}>
                      <label>
                        <span>{label}</span>
                        <input
                          inputMode="decimal"
                          dir="ltr"
                          value={draft[costType].amount}
                          disabled={!canManage || savingGroup === group.cohort_month}
                          onChange={(event) =>
                            updateDraft(group.cohort_month, costType, {
                              amount: event.currentTarget.value.trim(),
                              confirmed: false,
                            })
                          }
                          aria-label={`${label} ${group.cohort_month}`}
                        />
                      </label>
                      <label>
                        <span>مصدر المبلغ</span>
                        <select
                          value={draft[costType].method}
                          disabled={!canManage || savingGroup === group.cohort_month}
                          onChange={(event) =>
                            updateDraft(group.cohort_month, costType, { method: event.currentTarget.value as Method })
                          }
                          aria-label={`مصدر ${label} ${group.cohort_month}`}
                        >
                          <option value="direct_actual">مرتبطة مباشرة بهذه المجموعة</option>
                          <option value="explicit_allocation">توزيع من تكلفة مشتركة (تقديري)</option>
                        </select>
                      </label>
                      <label className={styles.noteField}>
                        <span>المصدر أو ملاحظة — اختياري</span>
                        <input
                          value={draft[costType].note}
                          maxLength={500}
                          disabled={!canManage || savingGroup === group.cohort_month}
                          onChange={(event) => updateDraft(group.cohort_month, costType, { note: event.currentTarget.value })}
                          aria-label={`ملاحظة ${label} ${group.cohort_month}`}
                        />
                      </label>
                    </div>
                    <p className={styles.costGuidance}>{guidance}</p>
                    {positive && (
                      <label className={styles.eligibilityCheck}>
                        <input
                          type="checkbox"
                          checked={draft[costType].confirmed}
                          disabled={!canManage || savingGroup === group.cohort_month}
                          onChange={(event) =>
                            updateDraft(group.cohort_month, costType, { confirmed: event.currentTarget.checked })
                          }
                          aria-label={`تأكيد أهلية ${label} ${group.cohort_month}`}
                        />
                        <span>{confirmation}</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {invalidGroups.has(group.cohort_month) && touchedGroups.has(group.cohort_month) && (
              <div className={styles.error}>أدخل قيمة رقمية غير سالبة في الخانات الأربع. الصفر مسموح.</div>
            )}
            {unconfirmedPositiveGroups.has(group.cohort_month) && (
              <div className={styles.notice}>
                يوجد مبلغ موجب لم تتم مراجعة أهليته بعد. راجع التأكيد الموجود أسفل التكلفة قبل الحفظ.
              </div>
            )}
            <button
              type="button"
              disabled={
                !canManage ||
                invalidGroups.has(group.cohort_month) ||
                unconfirmedPositiveGroups.has(group.cohort_month) ||
                savingGroup === group.cohort_month
              }
              onClick={() => void save(group.cohort_month)}
            >
              {savingGroup === group.cohort_month ? "جاري الحفظ…" : "حفظ التكاليف بعد المراجعة"}
            </button>
          </article>
        );
      })}

      {groups.length === 0 && (
        <div className={styles.notice}>لا توجد مجموعات عملاء بدأت الشراء بعد.</div>
      )}
    </section>
  );
}
