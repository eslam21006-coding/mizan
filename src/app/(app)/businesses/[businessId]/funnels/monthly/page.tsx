import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import {
  calculateFunnelMetrics,
  type FunnelMetric,
  type FunnelMetricUnavailableReason,
} from "@/lib/business/funnel-calculations";
import { FUNNEL_TYPE_OPTIONS, parseFunnelResourceId } from "@/lib/business/funnels";
import { loadFunnelMonth, type FunnelMonthlyEntrySnapshot } from "@/lib/business/funnel-month";
import { currentMonthKeyForTimeZone, parseMonthKey } from "@/lib/business/monthly";
import type { ExactRatio } from "@/lib/business/calculations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveFunnelMonthlyActuals } from "./actions";
import styles from "./monthly.module.css";

type FunnelMonthlyPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ month?: string; status?: string }>;
};

type BusinessRow = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  owner_user_id: string;
};

type FunnelRow = {
  id: string;
  name: string;
  funnel_type: string;
  is_active: boolean;
};

const STATUS_MESSAGES: Record<string, string> = {
  saved: "تم حفظ أرقام الفانلز لهذا الشهر.",
  "invalid-month": "الشهر المحدد غير صالح.",
  "invalid-input": "راجع القيم المدخلة. الأرقام يجب أن تكون صالحة وغير سالبة، باستثناء Attributed Revenue الذي قد يكون سالبًا بعد المرتجعات.",
  "save-failed": "تعذر حفظ أرقام الفانلز. لم يتم افتراض أو تعديل أي رقم آخر.",
};

const UNAVAILABLE_LABELS: Record<FunnelMetricUnavailableReason, string> = {
  INPUT_UNAVAILABLE: "بيانات غير مكتملة",
  NO_LEADS: "لا يوجد Leads",
  NO_BOOKED_CALLS: "لا توجد مكالمات محجوزة",
  NO_SHOWED_CALLS: "لا توجد مكالمات حضرت",
  NO_QUALIFIED_CALLS: "لا توجد مكالمات مؤهلة",
  NO_NEW_CUSTOMERS: "لا يوجد عملاء جدد",
  NO_AD_SPEND: "لا يوجد إنفاق إعلاني",
  ATTRIBUTION_UNAVAILABLE: "الإسناد غير متاح",
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function localizeDigits(value: string) {
  return value.replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)] ?? digit);
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
}

function formatExactDecimal(value: string) {
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

function formatMetric(
  metric: FunnelMetric<ExactRatio>,
  kind: "money" | "percent" | "multiple",
  currency: string,
) {
  if (!metric.available) {
    return { value: UNAVAILABLE_LABELS[metric.reason], unavailable: true as const };
  }

  if (kind === "percent") {
    return {
      value: `${formatExactDecimal(roundedRatioString(metric.value, 1, 100n))}%`,
      unavailable: false as const,
    };
  }

  if (kind === "multiple") {
    return {
      value: `${formatExactDecimal(roundedRatioString(metric.value, 2))}×`,
      unavailable: false as const,
    };
  }

  return {
    value: `${formatExactDecimal(roundedRatioString(metric.value, 2))} ${currency}`,
    unavailable: false as const,
  };
}

function funnelTypeLabel(value: string) {
  return FUNNEL_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function rawValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function blankEntry(funnel: FunnelRow): FunnelMonthlyEntrySnapshot {
  return {
    funnel_id: funnel.id,
    funnel_name_snapshot: funnel.name,
    funnel_type_snapshot: funnel.funnel_type,
    ad_spend: null,
    leads: null,
    booked_calls: null,
    showed_calls: null,
    qualified_calls: null,
    sales: null,
    new_customers: null,
    cash_collected: null,
    attributed_revenue: null,
  };
}

function ReconciliationPanel({
  status,
  businessAdSpend,
  funnelTotal,
  difference,
  canonical,
  currency,
}: {
  status: string;
  businessAdSpend: string | null;
  funnelTotal: string | null;
  difference: string | null;
  canonical: string | null;
  currency: string;
}) {
  const messages: Record<string, string> = {
    matched: "إجمالي إنفاق البزنس يطابق مجموع إنفاق الفانلز. لا يوجد Double Count.",
    mismatch: "يوجد اختلاف بين إجمالي إنفاق البزنس ومجموع الفانلز. ميزان لن يجمعهما معًا؛ راجع التوزيع.",
    business_only: "سيُستخدم إجمالي إنفاق البزنس كمصدر معتمد، لكن توزيع الإنفاق على الفانلز غير مكتمل.",
    funnel_only: "لا يوجد إجمالي مستقل للبزنس، لذلك سيُستخدم مجموع الفانلز المكتمل كمصدر معتمد.",
    incomplete: "لا يوجد إجمالي إنفاق إعلاني معتمد بعد. أدخل إجمالي البزنس أو أكمل Ad Spend لكل فانل ظاهرة.",
  };

  return (
    <section className={status === "mismatch" ? styles.reconciliationWarning : styles.reconciliation}>
      <div>
        <span className={styles.kicker}>تسوية الإنفاق الإعلاني</span>
        <h2>{status === "mismatch" ? "يوجد فرق يحتاج مراجعة" : "مصدر Total Ad Spend"}</h2>
        <p>{messages[status] ?? messages.incomplete}</p>
      </div>
      <dl className={styles.reconciliationValues}>
        <div>
          <dt>إجمالي البزنس</dt>
          <dd>{businessAdSpend === null ? "غير متاح" : `${formatExactDecimal(businessAdSpend)} ${currency}`}</dd>
        </div>
        <div>
          <dt>مجموع الفانلز</dt>
          <dd>{funnelTotal === null ? "غير مكتمل" : `${formatExactDecimal(funnelTotal)} ${currency}`}</dd>
        </div>
        {status === "mismatch" && (
          <div>
            <dt>الفرق</dt>
            <dd>{difference === null ? "—" : `${formatExactDecimal(difference)} ${currency}`}</dd>
          </div>
        )}
        <div>
          <dt>المعتمد لـ Media CAC / MER</dt>
          <dd>{canonical === null ? "غير متاح" : `${formatExactDecimal(canonical)} ${currency}`}</dd>
        </div>
      </dl>
    </section>
  );
}

export default async function FunnelMonthlyPage({ params, searchParams }: FunnelMonthlyPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseFunnelResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !businessData) notFound();
  const business = businessData as BusinessRow;
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;
  const query = await searchParams;
  const fallbackMonth = currentMonthKeyForTimeZone(business.timezone);
  const selectedMonth = parseMonthKey(query.month) ?? parseMonthKey(fallbackMonth);
  if (!selectedMonth) throw new Error("Could not resolve a valid funnel month.");

  const [funnelMonth, funnelsResult] = await Promise.all([
    loadFunnelMonth(supabase, businessId, selectedMonth.monthStart),
    supabase
      .from("funnels")
      .select("id,name,funnel_type,is_active")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
  ]);

  const dataLoadError = funnelMonth.dataLoadError || Boolean(funnelsResult.error);
  const allFunnels = (funnelsResult.data ?? []) as FunnelRow[];
  const existingById = new Map(funnelMonth.entries.map((entry) => [entry.funnel_id, entry]));
  const calculatedById = new Map(
    funnelMonth.calculatedEntries.map((calculated) => [calculated.entry.funnel_id, calculated]),
  );
  const visibleFunnels = allFunnels.filter(
    (funnel) => funnel.is_active || existingById.has(funnel.id),
  );

  const reconciliation = funnelMonth.reconciliation;
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
          title="أرقام الفانلز الشهرية"
          description={`تتبّع أداء فانلز ${business.name} في ${monthLabel}. هذه طبقة Drill-down ولا تستبدل اقتصاديات البزنس الأساسية.`}
        />
        <div className={styles.headerLinks}>
          <Link href={`/?business=${businessId}&month=${selectedMonth.monthKey}`}>الداشبورد</Link>
          <Link href={`/businesses/${businessId}/funnels`}>إدارة الفانلز</Link>
        </div>
      </div>

      {statusMessage && (
        <div className={statusError ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      <section className={styles.monthControl}>
        <form>
          <label>
            <span>الشهر</span>
            <input
              type="month"
              dir="ltr"
              name="month"
              defaultValue={selectedMonth.monthKey}
              aria-label="شهر أرقام الفانلز"
            />
          </label>
          <button type="submit">فتح الشهر</button>
        </form>
        <p>القيم الفارغة تعني «غير معروفة»، بينما 0 يعني أن القيمة معروفة وتساوي صفرًا.</p>
      </section>

      {dataLoadError ? (
        <section className={styles.loadError} role="alert">
          <strong>تعذر تحميل أرقام الفانلز بأمان</strong>
          <p>لن يتم عرض أو حفظ قيم جزئية حتى ينجح تحميل الشهر بالكامل.</p>
        </section>
      ) : (
        <>
          <ReconciliationPanel
            status={reconciliation.status}
            businessAdSpend={
              reconciliation.businessAdSpend.available ? reconciliation.businessAdSpend.value : null
            }
            funnelTotal={
              reconciliation.funnelAdSpendTotal.available
                ? reconciliation.funnelAdSpendTotal.value
                : null
            }
            difference={reconciliation.difference.available ? reconciliation.difference.value : null}
            canonical={
              reconciliation.canonicalAdSpend.available ? reconciliation.canonicalAdSpend.value : null
            }
            currency={business.base_currency}
          />

          {!canManage && (
            <section className={styles.readOnlyNotice}>
              <strong>عرض فقط</strong>
              <p>يمكنك مشاهدة أرقام الفانلز، لكن التعديل متاح لمالك البزنس أو الأدمن فقط.</p>
            </section>
          )}

          <form action={canManage ? saveFunnelMonthlyActuals : undefined} className={styles.metricsForm}>
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="month" value={selectedMonth.monthKey} />

            <section className={styles.businessSpendCard}>
              <div>
                <span className={styles.kicker}>Business-level</span>
                <h2>Total Ad Spend</h2>
                <p>
                  هذا الرقم هو المرجع لـ Media CAC و MER فقط. لا يضيف مصروفًا جديدًا إلى صافي الربح؛
                  سجّل تكلفة الإعلان ضمن Acquisition في الإدخال الشهري للبزنس.
                </p>
              </div>
              <label>
                <span>إجمالي الإنفاق الإعلاني للبزنس — {business.base_currency}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  name="business_ad_spend"
                  defaultValue={rawValue(funnelMonth.period?.business_ad_spend)}
                  placeholder="اتركه فارغًا إذا ستعتمد على مجموع الفانلز"
                  readOnly={!canManage}
                />
              </label>
            </section>

            {visibleFunnels.length === 0 ? (
              <section className={styles.emptyState}>
                <strong>لا توجد فانلز نشطة لهذا الشهر</strong>
                <p>
                  يمكنك حفظ Total Ad Spend للبزنس بدون فانلز، أو إضافة فانل من صفحة إدارة الفانلز.
                </p>
              </section>
            ) : (
              <div className={styles.funnelList}>
                {visibleFunnels.map((funnel) => {
                  const entry = existingById.get(funnel.id) ?? blankEntry(funnel);
                  const calculated = calculatedById.get(funnel.id);
                  const result =
                    calculated?.result ??
                    calculateFunnelMetrics({
                      adSpend: null,
                      leads: null,
                      bookedCalls: null,
                      showedCalls: null,
                      qualifiedCalls: null,
                      sales: null,
                      newCustomers: null,
                      cashCollected: null,
                      attributedRevenue: null,
                    });
                  const displayName = existingById.has(funnel.id)
                    ? entry.funnel_name_snapshot
                    : funnel.name;
                  const displayType = existingById.has(funnel.id)
                    ? entry.funnel_type_snapshot
                    : funnel.funnel_type;
                  const metricRows = [
                    ["CPL", formatMetric(result.cpl, "money", business.base_currency)],
                    [
                      "Cost / Booking",
                      formatMetric(result.costPerBooking, "money", business.base_currency),
                    ],
                    ["Cost / Show", formatMetric(result.costPerShow, "money", business.base_currency)],
                    [
                      "Cost / Qualified",
                      formatMetric(result.costPerQualifiedCall, "money", business.base_currency),
                    ],
                    ["Show Rate", formatMetric(result.showRate, "percent", business.base_currency)],
                    [
                      "Qualification Rate",
                      formatMetric(result.qualificationRate, "percent", business.base_currency),
                    ],
                    ["Close Rate", formatMetric(result.closeRate, "percent", business.base_currency)],
                    [
                      "Lead → Sale",
                      formatMetric(result.leadToSaleRate, "percent", business.base_currency),
                    ],
                    ["Media CAC", formatMetric(result.mediaCac, "money", business.base_currency)],
                    ["ROAS", formatMetric(result.roas, "multiple", business.base_currency)],
                  ] as const;

                  return (
                    <article className={styles.funnelCard} key={funnel.id}>
                      <input type="hidden" name="funnel_id" value={funnel.id} />
                      <div className={styles.funnelHeading}>
                        <div>
                          <span className={styles.typeBadge}>{funnelTypeLabel(displayType)}</span>
                          {!funnel.is_active && <span className={styles.inactiveBadge}>غير نشطة حاليًا</span>}
                          <h2>{displayName}</h2>
                        </div>
                        <div className={styles.healthBadges}>
                          <span data-health={result.showRateHealth}>
                            Show Rate: {result.showRateHealth === "healthy" ? "صحي" : result.showRateHealth === "below_benchmark" ? "أقل من الحد الصحي" : "غير متاح"}
                          </span>
                          <span data-health={result.closeRateHealth}>
                            Close Rate: {result.closeRateHealth === "healthy" ? "صحي" : result.closeRateHealth === "below_benchmark" ? "أقل من الحد الصحي" : "غير متاح"}
                          </span>
                        </div>
                      </div>

                      <div className={styles.inputGrid}>
                        <label>
                          <span>Ad Spend</span>
                          <input type="text" inputMode="decimal" name={`ad_spend_${funnel.id}`} defaultValue={rawValue(entry.ad_spend)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Leads</span>
                          <input type="text" inputMode="numeric" name={`leads_${funnel.id}`} defaultValue={rawValue(entry.leads)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Booked Calls</span>
                          <input type="text" inputMode="numeric" name={`booked_calls_${funnel.id}`} defaultValue={rawValue(entry.booked_calls)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Showed Calls</span>
                          <input type="text" inputMode="numeric" name={`showed_calls_${funnel.id}`} defaultValue={rawValue(entry.showed_calls)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Qualified Calls</span>
                          <input type="text" inputMode="numeric" name={`qualified_calls_${funnel.id}`} defaultValue={rawValue(entry.qualified_calls)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Sales</span>
                          <input type="text" inputMode="numeric" name={`sales_${funnel.id}`} defaultValue={rawValue(entry.sales)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>New Customers</span>
                          <input type="text" inputMode="numeric" name={`new_customers_${funnel.id}`} defaultValue={rawValue(entry.new_customers)} readOnly={!canManage} />
                        </label>
                        <label>
                          <span>Cash Collected — {business.base_currency}</span>
                          <input type="text" inputMode="decimal" name={`cash_collected_${funnel.id}`} defaultValue={rawValue(entry.cash_collected)} readOnly={!canManage} />
                        </label>
                        <label className={styles.attributionField}>
                          <span>Attributed Revenue — {business.base_currency}</span>
                          <input type="text" inputMode="decimal" name={`attributed_revenue_${funnel.id}`} defaultValue={rawValue(entry.attributed_revenue)} readOnly={!canManage} />
                          <small>اتركه فارغًا إذا لا يوجد إسناد حقيقي. لا تستخدم Cash Collected كبديل.</small>
                        </label>
                      </div>

                      <div className={styles.metricGrid}>
                        {metricRows.map(([label, metric]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong className={metric.unavailable ? styles.unavailable : undefined}>
                              {metric.value}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <p className={styles.benchmarkNote}>
                        Show Rate صحي فقط عندما يكون أكبر من ٦٥٪، و Close Rate صحي فقط عندما يكون
                        أكبر من ٢٠٪. المساواة بالحد ليست «صحية» حسب قاعدة ميزان.
                      </p>
                    </article>
                  );
                })}
              </div>
            )}

            {canManage && (
              <div className={styles.saveBar}>
                <p>الحفظ يغيّر أرقام هذا الشهر فقط ولا يغيّر البيانات التاريخية لأي شهر آخر.</p>
                <button type="submit">حفظ أرقام الفانلز</button>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}
