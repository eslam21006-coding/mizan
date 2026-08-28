import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import type { ExactRatio } from "@/lib/business/calculations";
import { exactRatioFromRational } from "@/lib/business/exact-rational";
import {
  formatArabicExactPercent,
  formatArabicExactRatio,
} from "@/lib/business/format-exact";
import { loadDashboardMonth } from "@/lib/business/dashboard-month";
import { loadFunnelMonth } from "@/lib/business/funnel-month";
import {
  currentMonthKeyForTimeZone,
  parseOptionalDecimalInput,
  shiftMonthKey,
} from "@/lib/business/monthly";
import {
  TARGET_GOAL_TYPES,
  TargetEngineInputError,
  planTarget,
  resolveRolling3TargetAssumptions,
  type TargetGoalType,
  type TargetPlanResult,
  type TargetPlannerAssumptions,
} from "@/lib/business/target-engine";
import {
  buildTargetPlannerActualMonth,
  type TargetPlannerActualMonthBlocker,
} from "@/lib/business/target-planner-actuals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import dashboardStyles from "../dashboard.module.css";

type TargetPlanPageProps = {
  searchParams: Promise<{ business?: string; goal?: string; value?: string }>;
};

type BusinessRow = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
};

type PlannerMonthIssue = {
  month: string;
  message: string;
};

const ACTUAL_BLOCKER_COPY: Record<TargetPlannerActualMonthBlocker, string> = {
  CORE_METRIC_UNAVAILABLE: "الأرقام المالية الأساسية لهذا الشهر غير مكتملة.",
  EXPENSE_AMOUNT_UNAVAILABLE: "يوجد بند مصروف لا يمكن حساب قيمته الفعلية لهذا الشهر.",
  AD_SPEND_UNAVAILABLE: "الإنفاق الإعلاني الفعلي غير متاح أو غير متصالح.",
  MEDIA_EXCEEDS_FIXED_ACQUISITION:
    "لا يمكن فصل الإنفاق الإعلاني عن تكاليف الاكتساب بأمان. راجع مصروفات الاكتساب والإنفاق الإعلاني.",
  FUNNEL_DATA_UNAVAILABLE: "بيانات الفانل المطلوبة لحساب معدلات التحويل غير مكتملة.",
  FUNNEL_CUSTOMER_MISMATCH: "إجمالي العملاء الجدد في الفانلز لا يطابق إجمالي العملاء الجدد في البزنس.",
  FUNNEL_SEQUENCE_INVALID: "تسلسل أرقام الفانل غير منطقي لهذا الشهر.",
};

function monthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${monthKey}-01T00:00:00.000Z`),
  );
}

function isGoalType(value: string | undefined): value is TargetGoalType {
  return TARGET_GOAL_TYPES.includes(value as TargetGoalType);
}

function percentToRatio(value: string): ExactRatio | null {
  const [whole, fraction = ""] = value.split(".");
  const numerator = BigInt(`${whole}${fraction}` || "0");
  const decimalDenominator = 10n ** BigInt(fraction.length);
  const denominator = decimalDenominator * 100n;
  if (numerator <= 0n || numerator > denominator) return null;
  return exactRatioFromRational({ numerator, denominator });
}

function money(value: ExactRatio, currency: string) {
  return `${formatArabicExactRatio(value, 2)} ${currency}`;
}

function count(value: number) {
  return new Intl.NumberFormat("ar-EG").format(value);
}

function goalLabel(goal: TargetGoalType) {
  if (goal === "revenue") return "هدف الإيراد";
  if (goal === "net_profit") return "هدف صافي الربح";
  return "هدف هامش صافي الربح";
}

function unavailableMetricCopy(reason: string) {
  if (reason === "NEGATIVE_ACQUISITION_HEADROOM") return "غير متاح: الهدف لا يترك ميزانية اكتساب مستدامة.";
  if (reason === "NEGATIVE_MEDIA_HEADROOM") return "غير متاح: تكاليف الاكتساب غير الإعلانية تستهلك الميزانية المتاحة.";
  return "غير متاح لهذا الهدف.";
}

function renderMetric(
  metric: { available: true; value: ExactRatio } | { available: false; reason: string },
  currency: string,
) {
  return metric.available ? money(metric.value, currency) : unavailableMetricCopy(metric.reason);
}

export default async function TargetPlanPage({ searchParams }: TargetPlanPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: businessesData, error: businessesError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });
  const businesses = (businessesData ?? []) as BusinessRow[];

  if (businessesError) {
    return (
      <div className="page-stack">
        <PageHeading title="خطة الوصول للهدف" description="حوّل الهدف المالي إلى متطلبات تشغيلية واضحة." />
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لن يبني ميزان خطة على بيانات غير مؤكدة.</p>
        </section>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading title="خطة الوصول للهدف" description="حوّل الهدف المالي إلى متطلبات تشغيلية واضحة." />
        <section className={dashboardStyles.emptyState}>
          <span className={dashboardStyles.eyebrow}>لا يوجد بزنس بعد</span>
          <h2>أضف بزنسًا أولًا</h2>
          <p>خطة الهدف تحتاج تاريخًا ماليًا وفانل فعليًا حتى لا تعتمد على افتراضات مخترعة.</p>
          <Link className={dashboardStyles.primaryAction} href="/businesses/new">
            إعداد أول بزنس
          </Link>
        </section>
      </div>
    );
  }

  const selectedBusiness = businesses.find((business) => business.id === query.business) ?? businesses[0];
  const currentMonth = currentMonthKeyForTimeZone(selectedBusiness.timezone);
  const lastCompleteMonth = shiftMonthKey(currentMonth, -1);
  const rollingMonths = lastCompleteMonth
    ? [shiftMonthKey(lastCompleteMonth, -2), shiftMonthKey(lastCompleteMonth, -1), lastCompleteMonth]
    : [];

  const issues: PlannerMonthIssue[] = [];
  const actualMonths = [];

  if (rollingMonths.length !== 3 || rollingMonths.some((month) => month === null)) {
    issues.push({ month: currentMonth, message: "تعذر تحديد آخر ثلاثة أشهر مكتملة بأمان." });
  } else {
    const monthKeys = rollingMonths as string[];
    const loads = await Promise.all(
      monthKeys.map(async (month) => {
        const monthStart = `${month}-01`;
        const [dashboard, funnel] = await Promise.all([
          loadDashboardMonth(supabase, selectedBusiness.id, monthStart),
          loadFunnelMonth(supabase, selectedBusiness.id, monthStart),
        ]);
        return { month, dashboard, funnel };
      }),
    );

    for (const load of loads) {
      if (load.dashboard.dataLoadError || load.dashboard.calculationError) {
        issues.push({ month: load.month, message: "تعذر حساب الأرقام المالية لهذا الشهر بأمان." });
        continue;
      }
      if (!load.dashboard.periodExists || !load.dashboard.result) {
        issues.push({ month: load.month, message: "لا توجد أرقام شهرية محفوظة." });
        continue;
      }
      if (
        load.funnel.dataLoadError ||
        load.funnel.reconciliationError ||
        !load.funnel.reconciliation.canonicalAdSpend.available
      ) {
        issues.push({ month: load.month, message: "بيانات الفانل أو الإنفاق الإعلاني غير مكتملة." });
        continue;
      }

      const actual = buildTargetPlannerActualMonth({
        month: load.month,
        core: load.dashboard.result,
        canonicalAdSpend: String(load.funnel.reconciliation.canonicalAdSpend.value),
        funnelEntries: load.funnel.entries,
      });
      if (actual.status === "insufficient") {
        issues.push({ month: load.month, message: ACTUAL_BLOCKER_COPY[actual.blocker] });
        continue;
      }
      actualMonths.push(actual.actual);
    }
  }

  let assumptions: TargetPlannerAssumptions | null = null;
  if (issues.length === 0 && lastCompleteMonth && actualMonths.length === 3) {
    try {
      const resolved = resolveRolling3TargetAssumptions(actualMonths, lastCompleteMonth);
      if (resolved.status === "ready") {
        assumptions = resolved.assumptions;
      } else {
        for (const blocker of resolved.blockers) {
          issues.push({
            month: blocker.month ?? lastCompleteMonth,
            message:
              blocker.code === "NON_POSITIVE_NET_CASH"
                ? "صافي الكاش في فترة الافتراضات غير موجب."
                : blocker.code === "INCONSISTENT_FUNNEL_SEQUENCE"
                  ? "تسلسل أرقام الفانل غير متسق."
                  : "بيانات الفترة غير كافية لبناء أحد افتراضات الخطة.",
          });
        }
      }
    } catch (error) {
      if (error instanceof TargetEngineInputError) {
        issues.push({ month: lastCompleteMonth, message: "تعذر بناء افتراضات Rolling 3 Months من البيانات الحالية." });
      } else {
        throw error;
      }
    }
  }

  const selectedGoal: TargetGoalType = isGoalType(query.goal) ? query.goal : "revenue";
  const parsedValue = parseOptionalDecimalInput(query.value);
  const normalizedValue = parsedValue.ok ? parsedValue.value : null;
  let inputError: string | null = null;
  let plan: TargetPlanResult | null = null;

  if (query.value !== undefined) {
    if (!parsedValue.ok || normalizedValue === null || /^0(?:\.0+)?$/.test(normalizedValue)) {
      inputError = "أدخل هدفًا موجبًا بصيغة رقمية صحيحة.";
    } else if (assumptions) {
      try {
        if (selectedGoal === "net_profit_margin") {
          const margin = percentToRatio(normalizedValue);
          if (!margin) {
            inputError = "هامش صافي الربح يجب أن يكون أكبر من 0% وحتى 100%.";
          } else {
            plan = planTarget({ type: selectedGoal, margin }, assumptions);
          }
        } else {
          plan = planTarget({ type: selectedGoal, amount: normalizedValue }, assumptions);
        }
      } catch (error) {
        if (error instanceof TargetEngineInputError) {
          inputError = "لا يمكن حساب هذا الهدف من الافتراضات الحالية بأمان.";
        } else {
          throw error;
        }
      }
    }
  }

  return (
    <div className="page-stack">
      <div className={dashboardStyles.dashboardHeader}>
        <PageHeading
          title="خطة الوصول للهدف"
          description="حدد هدف الإيراد أو صافي الربح أو هامش صافي الربح، وسيحوّله ميزان إلى العملاء والمبيعات والمكالمات والليدز والإنفاق المطلوب."
        />
        <div className={dashboardStyles.headerActions}>
          <Link className={dashboardStyles.secondaryAction} href={`/?business=${selectedBusiness.id}`}>
            فتح الداشبورد
          </Link>
          <Link className={dashboardStyles.secondaryAction} href="/analytics">
            التحليلات
          </Link>
        </div>
      </div>

      <section className={dashboardStyles.controls} aria-label="اختيار بزنس خطة الهدف">
        <form className={dashboardStyles.controlForm}>
          <input type="hidden" name="goal" value={selectedGoal} />
          {query.value !== undefined && <input type="hidden" name="value" value={query.value} />}
          <label>
            <span>البزنس</span>
            <select name="business" defaultValue={selectedBusiness.id}>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name} — {business.base_currency}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">فتح البزنس</button>
        </form>
        <div className={dashboardStyles.periodBadge}>
          <span>مصدر الافتراضات</span>
          <strong>آخر 3 أشهر مكتملة</strong>
          <small>{lastCompleteMonth ? `حتى ${monthLabel(lastCompleteMonth)}` : "غير متاح"}</small>
        </div>
        <div className={dashboardStyles.periodBadge}>
          <span>العملة</span>
          <strong>{selectedBusiness.base_currency}</strong>
          <small>كل أرقام الخطة بنفس عملة البزنس الأساسية</small>
        </div>
      </section>

      {issues.length > 0 ? (
        <section className={dashboardStyles.errorPanel} role="alert">
          <strong>البيانات غير كافية لبناء خطة الهدف</strong>
          <p>ميزان لن يخترع افتراضات. أكمل الأشهر التالية ثم أعد المحاولة:</p>
          <div className={dashboardStyles.headerActions}>
            {issues.map((issue, index) => (
              <Link
                className={dashboardStyles.secondaryAction}
                href={`/businesses/${selectedBusiness.id}/monthly?month=${issue.month}`}
                key={`${issue.month}-${issue.message}-${index}`}
              >
                {monthLabel(issue.month)} — {issue.message}
              </Link>
            ))}
          </div>
        </section>
      ) : assumptions ? (
        <>
          <section className={dashboardStyles.sectionCard}>
            <div className={dashboardStyles.sectionHeading}>
              <div>
                <span className={dashboardStyles.eyebrow}>الهدف</span>
                <h2>ما الذي تريد الوصول إليه شهريًا؟</h2>
              </div>
              <p>الخطة تستخدم نفس افتراضات Rolling 3 Months الظاهرة أدناه، بدون AI أو تخمينات مخفية.</p>
            </div>
            <form className={dashboardStyles.controlForm}>
              <input type="hidden" name="business" value={selectedBusiness.id} />
              <label>
                <span>نوع الهدف</span>
                <select name="goal" defaultValue={selectedGoal}>
                  <option value="revenue">الإيراد</option>
                  <option value="net_profit">صافي الربح</option>
                  <option value="net_profit_margin">هامش صافي الربح</option>
                </select>
              </label>
              <label>
                <span>{selectedGoal === "net_profit_margin" ? "النسبة المستهدفة %" : `القيمة المستهدفة — ${selectedBusiness.base_currency}`}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="value"
                  defaultValue={query.value ?? ""}
                  placeholder={selectedGoal === "net_profit_margin" ? "مثال: 40" : "مثال: 50000"}
                  dir="ltr"
                  required
                />
              </label>
              <button type="submit">احسب الخطة</button>
            </form>
            {inputError && <p className={dashboardStyles.definitionNote}>{inputError}</p>}
          </section>

          <section className={dashboardStyles.sectionCard}>
            <div className={dashboardStyles.sectionHeading}>
              <div>
                <span className={dashboardStyles.eyebrow}>الافتراضات المستخدمة</span>
                <h2>{assumptions.source.kind === "rolling_3_months" ? assumptions.source.months.map(monthLabel).join(" — ") : "افتراضات يدوية"}</h2>
              </div>
              <p>هذه ليست أهدافًا؛ هي معدلات وقيم فعلية يستخدمها المحرك لعكس الهدف إلى متطلبات تشغيلية.</p>
            </div>
            <div className={dashboardStyles.secondaryMetrics}>
              <div className={dashboardStyles.metricCard}><span>الإيراد لكل عميل جديد</span><strong>{money(assumptions.revenuePerNewCustomer, selectedBusiness.base_currency)}</strong></div>
              <div className={dashboardStyles.metricCard}><span>Media CAC المفترض</span><strong>{money(assumptions.assumedMediaCac, selectedBusiness.base_currency)}</strong></div>
              <div className={dashboardStyles.metricCard}><span>Booking Rate</span><strong>{formatArabicExactPercent(assumptions.bookingRate)}%</strong></div>
              <div className={dashboardStyles.metricCard}><span>Show Rate</span><strong>{formatArabicExactPercent(assumptions.showRate)}%</strong></div>
              <div className={dashboardStyles.metricCard}><span>Qualification Rate</span><strong>{formatArabicExactPercent(assumptions.qualificationRate)}%</strong></div>
              <div className={dashboardStyles.metricCard}><span>Close Rate</span><strong>{formatArabicExactPercent(assumptions.closeRate)}%</strong></div>
              <div className={dashboardStyles.metricCard}><span>Sale → New Customer</span><strong>{formatArabicExactPercent(assumptions.saleToNewCustomerRate)}%</strong></div>
              <div className={dashboardStyles.metricCard}><span>تكاليف اكتساب ثابتة غير إعلانية</span><strong>{money(assumptions.monthlyFixedAcquisitionCosts, selectedBusiness.base_currency)}</strong></div>
              <div className={dashboardStyles.metricCard}><span>تكاليف ثابتة غير اكتسابية</span><strong>{money(assumptions.monthlyFixedNonAcquisitionCosts, selectedBusiness.base_currency)}</strong></div>
              <div className={dashboardStyles.metricCard}><span>اكتساب متغير غير إعلاني / عميل جديد</span><strong>{money(assumptions.variableNonMediaAcquisitionCostPerNewCustomer, selectedBusiness.base_currency)}</strong></div>
              <div className={dashboardStyles.metricCard}><span>تكلفة متغيرة غير اكتسابية / عميل جديد</span><strong>{money(assumptions.variableNonAcquisitionCostPerNewCustomer, selectedBusiness.base_currency)}</strong></div>
            </div>
          </section>

          {plan?.status === "unattainable" && (
            <section className={dashboardStyles.errorPanel} role="alert">
              <strong>الهدف غير قابل للوصول بهذه الافتراضات</strong>
              <p>
                {plan.reason === "NON_POSITIVE_UNIT_PROFIT"
                  ? "الربح الوحدي قبل التكاليف الثابتة غير موجب، لذلك زيادة العملاء لا تحقق هدف الربح."
                  : "هامش الربح المستهدف أعلى مما تسمح به اقتصاديات العميل الحالية."}
              </p>
            </section>
          )}

          {plan?.status === "ready" && (
            <>
              <section className={dashboardStyles.sectionCard}>
                <div className={dashboardStyles.sectionHeading}>
                  <div>
                    <span className={dashboardStyles.eyebrow}>{goalLabel(selectedGoal)}</span>
                    <h2>المتطلبات المالية</h2>
                  </div>
                  <p>Maximum Sustainable CAC هنا هو Acquisition CAC المستدام، وليس Ultimate CAC.</p>
                </div>
                <div className={dashboardStyles.primaryMetrics}>
                  <div className={`${dashboardStyles.metricCard} ${dashboardStyles.featuredMetric}`}><span>الإيراد المطلوب</span><strong>{money(plan.requiredRevenue, selectedBusiness.base_currency)}</strong></div>
                  <div className={`${dashboardStyles.metricCard} ${dashboardStyles.featuredMetric}`}><span>العملاء الجدد المطلوبون</span><strong>{count(plan.requiredCustomers)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>الإنفاق الإعلاني المطلوب</span><strong>{money(plan.requiredAdSpend, selectedBusiness.base_currency)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>صافي الربح المتوقع</span><strong>{money(plan.projectedNetProfit, selectedBusiness.base_currency)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>هامش صافي الربح المتوقع</span><strong>{formatArabicExactPercent(plan.projectedMargin)}%</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Maximum Sustainable Acquisition CAC</span><strong>{renderMetric(plan.maximumSustainableAcquisitionCac, selectedBusiness.base_currency)}</strong><p>الحد الأقصى المستدام لتكلفة الاكتساب، وليس Ultimate CAC.</p></div>
                  <div className={dashboardStyles.metricCard}><span>Maximum Media CAC</span><strong>{renderMetric(plan.maximumMediaCac, selectedBusiness.base_currency)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Maximum CPL</span><strong>{renderMetric(plan.maximumCpl, selectedBusiness.base_currency)}</strong></div>
                </div>
              </section>

              <section className={dashboardStyles.sectionCard}>
                <div className={dashboardStyles.sectionHeading}>
                  <div>
                    <span className={dashboardStyles.eyebrow}>Reverse Engineering</span>
                    <h2>الفانل المطلوب للوصول للهدف</h2>
                  </div>
                  <p>يتم التقريب لأعلى عند كل مرحلة حتى لا تنتج الخطة عددًا أقل من المطلوب للوصول للهدف.</p>
                </div>
                <div className={dashboardStyles.secondaryMetrics}>
                  <div className={dashboardStyles.metricCard}><span>Sales</span><strong>{count(plan.requiredSales)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Qualified Calls</span><strong>{count(plan.requiredQualifiedCalls)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Shows</span><strong>{count(plan.requiredShows)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Bookings</span><strong>{count(plan.requiredBookings)}</strong></div>
                  <div className={dashboardStyles.metricCard}><span>Leads</span><strong>{count(plan.requiredLeads)}</strong></div>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
