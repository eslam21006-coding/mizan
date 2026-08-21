import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import type { ExactRatio } from "@/lib/business/calculations";
import {
  loadSelfLiquidationMonth,
  type FrontEndExpenseAllocationRow,
} from "@/lib/business/self-liquidating-month";
import type {
  LiquidationMetric,
  LiquidationUnavailableReason,
} from "@/lib/business/self-liquidating";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveFrontEndAllocations } from "./actions";
import styles from "./liquidation.module.css";

type LiquidationPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ month?: string; status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  saved: "تم حفظ توزيعات تكاليف الـ Front-End لهذا الشهر.",
  "invalid-month": "الشهر المحدد غير صالح.",
  "invalid-input": "راجع التوزيعات المدخلة. استخدم أرقامًا غير سالبة أو اترك القيمة فارغة إذا لم تكن معروفة.",
  "save-failed": "تعذر حفظ توزيعات الـ Front-End. لم يتم حفظ تعديل جزئي.",
};

const UNAVAILABLE_LABELS: Record<LiquidationUnavailableReason, string> = {
  FRONT_END_REVENUE_INCOMPLETE: "إيراد Front-End غير مكتمل",
  VARIABLE_COST_ALLOCATION_INCOMPLETE: "توزيع التكاليف المتغيرة غير مكتمل",
  AD_SPEND_UNAVAILABLE: "إجمالي الإنفاق الإعلاني غير متاح",
  NO_AD_SPEND: "لا يوجد إنفاق إعلاني",
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function localizeDigits(value: string) {
  return value.replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)] ?? digit);
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
}

function formatDecimal(value: string) {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, rawFraction = ""] = unsigned.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  const grouped = groupInteger(whole || "0");
  const localized = localizeDigits(fraction ? `${grouped}٫${fraction}` : grouped);
  return negative && localized !== "٠" ? `-${localized}` : localized;
}

function roundedRatioString(ratio: ExactRatio, fractionDigits: number, multiplier = 1n) {
  const numerator = BigInt(ratio.numerator) * multiplier;
  const denominator = BigInt(ratio.denominator);
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const scale = 10n ** BigInt(fractionDigits);
  let scaled = (absNumerator * scale) / absDenominator;
  const remainder = (absNumerator * scale) % absDenominator;
  if (remainder * 2n >= absDenominator) scaled += 1n;
  const digits = scaled.toString().padStart(fractionDigits + 1, "0");
  const whole = fractionDigits === 0 ? digits : digits.slice(0, -fractionDigits);
  const fraction = fractionDigits === 0 ? "" : digits.slice(-fractionDigits).replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole;
  return `${negative && scaled !== 0n ? "-" : ""}${text}`;
}

function formatMoney(metric: LiquidationMetric<string>, currency: string) {
  return metric.available
    ? `${formatDecimal(metric.value)} ${currency}`
    : UNAVAILABLE_LABELS[metric.reason];
}

function formatRate(metric: LiquidationMetric<ExactRatio>) {
  return metric.available
    ? `${formatDecimal(roundedRatioString(metric.value, 1, 100n))}%`
    : UNAVAILABLE_LABELS[metric.reason];
}

function expenseBehaviorLabel(behavior: FrontEndExpenseAllocationRow["behavior"]) {
  return behavior === "per_customer" ? "Per Customer" : "% of Revenue";
}

export default async function LiquidationPage({ params, searchParams }: LiquidationPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business) notFound();

  const query = await searchParams;
  const fallbackMonth = currentMonthKeyForTimeZone(business.timezone);
  const selectedMonth = parseMonthKey(query.month) ?? parseMonthKey(fallbackMonth);
  if (!selectedMonth) throw new Error("Could not resolve a valid liquidation month.");

  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const month = await loadSelfLiquidationMonth(supabase, businessId, selectedMonth.monthStart);
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] : null;
  const statusError = Boolean(query.status && query.status !== "saved");
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${selectedMonth.monthStart}T00:00:00.000Z`));

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="تسييل الإنفاق الإعلاني"
          description={`اقتصاديات الـ Front-End في ${business.name} خلال ${monthLabel}. الحساب هنا على مستوى البزنس ولا يفترض توزيع الإيراد أو التكلفة على فانل منفردة.`}
        />
        <div className={styles.headerLinks}>
          <Link href={`/businesses/${businessId}/funnels/monthly?month=${selectedMonth.monthKey}`}>
            أرقام الفانلز
          </Link>
          <Link href={`/businesses/${businessId}/monthly?month=${selectedMonth.monthKey}`}>
            الإدخال الشهري
          </Link>
        </div>
      </div>

      {statusMessage && (
        <div
          className={statusError ? styles.errorStatus : styles.successStatus}
          role={statusError ? "alert" : "status"}
        >
          {statusMessage}
        </div>
      )}

      <section className={styles.scopeNotice}>
        <strong>حد الدقة في V1</strong>
        <p>
          ميزان يجمع كل مصادر الإيراد المصنفة Front-End ويقارن مساهمتها بإجمالي Ad Spend المعتمد.
          لا نعرض نسبة تسييل لفانل منفردة قبل وجود ربط صريح بين الفانل ومصادر الإيراد والتكاليف.
        </p>
      </section>

      <section className={styles.monthControl}>
        <form>
          <label>
            <span>الشهر</span>
            <input
              type="month"
              dir="ltr"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر تحليل التسييل"
            />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
      </section>

      {month.dataLoadError ? (
        <section className={styles.loadError} role="alert">
          <strong>تعذر تحميل بيانات التسييل بأمان</strong>
          <p>لن يتم عرض نتيجة جزئية حتى ينجح تحميل بيانات الشهر بالكامل.</p>
        </section>
      ) : !month.periodExists ? (
        <section className={styles.emptyState}>
          <strong>لا توجد بيانات بزنس لهذا الشهر</strong>
          <p>احفظ الإيراد والمصروفات الشهرية أولًا، ثم ارجع لتحليل تسييل الإنفاق.</p>
          <Link href={`/businesses/${businessId}/monthly?month=${selectedMonth.monthKey}`}>
            فتح الإدخال الشهري
          </Link>
        </section>
      ) : month.calculationError || !month.result ? (
        <section className={styles.loadError} role="alert">
          <strong>لا يمكن حساب التسييل من البيانات الحالية</strong>
          <p>يوجد رقم شهري غير صالح أو غير متسق. راجع بيانات الإيراد والمصروفات ثم حاول مرة أخرى.</p>
        </section>
      ) : (
        <>
          <section className={styles.metricGrid} aria-label="مؤشرات التسييل">
            <article>
              <span>Front-End Net Cash</span>
              <strong>{formatMoney(month.result.frontEndNetCash, business.base_currency)}</strong>
              <small>Front-End Gross Cash − Front-End Refunds</small>
            </article>
            <article>
              <span>Front-End Variable Costs</span>
              <strong>{formatMoney(month.result.frontEndVariableCosts, business.base_currency)}</strong>
              <small>التكاليف المتغيرة الموزعة صراحةً فقط</small>
            </article>
            <article>
              <span>Front-End Contribution Profit</span>
              <strong>
                {formatMoney(month.result.frontEndContributionProfit, business.base_currency)}
              </strong>
              <small>Net Cash − variable costs</small>
            </article>
            <article>
              <span>Ad Liquidation Rate</span>
              <strong>{formatRate(month.result.adLiquidationRate)}</strong>
              <small>القيم فوق ١٠٠٪ مسموحة</small>
            </article>
            <article>
              <span>Effective Remaining Ad Cost</span>
              <strong>
                {formatMoney(month.result.effectiveRemainingAdCost, business.base_currency)}
              </strong>
              <small>قد يكون سالبًا إذا غطّى الـ Front-End الإنفاق وزاد</small>
            </article>
            <article>
              <span>Canonical Total Ad Spend</span>
              <strong>
                {month.canonicalAdSpend === null
                  ? "غير متاح"
                  : `${formatDecimal(month.canonicalAdSpend)} ${business.base_currency}`}
              </strong>
              <small>من تسوية Task 15، بدون Double Count</small>
            </article>
          </section>

          {month.adSpendUnavailable && (
            <section className={styles.warning}>
              <strong>Ad Spend غير مكتمل</strong>
              <p>
                يمكن عرض Front-End Net Cash والتكاليف الموزعة، لكن Ad Liquidation Rate يحتاج Total Ad
                Spend معتمدًا من صفحة أرقام الفانلز.
              </p>
            </section>
          )}

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span>Front-End revenue</span>
                <h2>الإيراد الذي يدخل في التسييل</h2>
              </div>
            </div>
            {month.frontEndRevenueRows.length > 0 ? (
              <div className={styles.revenueList}>
                {month.frontEndRevenueRows.map((row) => (
                  <div className={styles.revenueRow} key={row.revenueStreamId}>
                    <strong>{row.name}</strong>
                    <span>
                      Gross: {row.grossCash === null ? "غير متاح" : formatDecimal(row.grossCash)} {business.base_currency}
                    </span>
                    <span>
                      Refunds: {row.refunds === null ? "غير متاح" : formatDecimal(row.refunds)} {business.base_currency}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>لا توجد مصادر إيراد مصنفة Front-End في هذا الشهر؛ Front-End Net Cash = 0.</p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span>Variable cost allocation</span>
                <h2>توزيع التكاليف المتغيرة على الـ Front-End</h2>
              </div>
              <Link href={`/businesses/${businessId}/expenses`}>إدارة المصروفات</Link>
            </div>

            <p className={styles.muted}>
              أدخل الجزء من كل تكلفة متغيرة الذي يخص اقتصاديات الـ Front-End. اكتب 0 إذا كنت تعرف أن
              لا شيء منها يخص Front-End، واتركها فارغة إذا كان التوزيع غير معروف. القيمة الفارغة تمنع
              عرض نتيجة تسييل دقيقة عندما تكون التكلفة الفعلية أكبر من صفر.
            </p>

            {!canManage && (
              <div className={styles.readOnlyNotice}>
                <strong>عرض فقط</strong>
                <p>التعديل متاح لمالك البزنس أو الأدمن فقط.</p>
              </div>
            )}

            {month.variableExpenseRows.length === 0 ? (
              <p className={styles.muted}>لا توجد تكاليف متغيرة في بيانات هذا الشهر.</p>
            ) : (
              <form action={canManage ? saveFrontEndAllocations : undefined} className={styles.allocationForm}>
                <input type="hidden" name="business_id" value={businessId} />
                <input type="hidden" name="month" value={selectedMonth.monthKey} />

                <div className={styles.allocationList}>
                  {month.variableExpenseRows.map((row) => (
                    <div className={styles.allocationRow} key={row.monthlyExpenseEntryId}>
                      <input
                        type="hidden"
                        name="monthly_expense_entry_id"
                        value={row.monthlyExpenseEntryId}
                      />
                      <div>
                        <strong>{row.name}</strong>
                        <span>{expenseBehaviorLabel(row.behavior)}</span>
                      </div>
                      <div>
                        <span>إجمالي التكلفة الفعلية</span>
                        <strong>
                          {row.expenseAmount === null
                            ? "غير متاح"
                            : `${formatDecimal(row.expenseAmount)} ${business.base_currency}`}
                        </strong>
                      </div>
                      <label>
                        <span>المخصص للـ Front-End</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          name={`allocation_${row.monthlyExpenseEntryId}`}
                          defaultValue={row.allocatedAmount ?? ""}
                          aria-label={`المخصص للـ Front-End — ${row.name}`}
                          placeholder="فارغ = غير معروف"
                          readOnly={!canManage || row.expenseAmount === null}
                        />
                      </label>
                    </div>
                  ))}
                </div>

                {canManage && (
                  <div className={styles.saveBar}>
                    <p>هذه التوزيعات تخص هذا الشهر فقط ولا تعدّل المصروفات التاريخية الأصلية.</p>
                    <button type="submit">حفظ توزيعات Front-End</button>
                  </div>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </div>
  );
}
