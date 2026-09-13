import Link from "next/link";
import { formatMoneyText } from "@/lib/financial-display";
import {
  reconcileCustomerEconomicsLegacyAllocations,
  saveCustomerEconomicsManualOverride,
} from "./actions";
import styles from "./review.module.css";

export type ReviewException = {
  activity_month: string | null;
  exception_code: string;
  authoritative_source_id: string | null;
  expense_name_snapshot: string | null;
  amount: string | number | null;
  currency: string | null;
  can_manual_override: boolean;
  blocking: boolean;
};

export type TrustedAcquisitionMonth = {
  cohortMonth: string;
};

export type LegacyAllocation = {
  id: string;
  cohort_month: string;
  cost_type: string;
  amount: string | number;
  note: string | null;
};

export type EligibleCostPool = {
  authoritative_source_id: string;
  activity_month: string;
  expense_name_snapshot: string;
  category_snapshot: string;
  authoritative_amount: string | number;
  currency: string | null;
};

type Props = {
  businessId: string;
  baseCurrency: string;
  canManage: boolean;
  exceptions: ReviewException[];
  trustedMonths: TrustedAcquisitionMonth[];
  legacyAllocations: LegacyAllocation[];
  eligibleCostPools: EligibleCostPool[];
  statusMessage?: string | null;
  statusIsError?: boolean;
};

function monthLabel(value: string | null) {
  if (!value) return "كل السجل";
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function money(value: string | number | null, currency: string) {
  if (value === null) return "—";
  return formatMoneyText(String(value), currency);
}

function exceptionCopy(code: string) {
  if (code === "INCOMPLETE_TRANSACTION_HISTORY") {
    return {
      title: "سجل معاملات العملاء غير مكتمل",
      detail:
        "ميزان لا يفترض أن أول معاملة مرفوعة هي أول شراء حقيقي. أكمل السجل أو أكد اكتماله قبل الاعتماد على شهر اكتساب العميل.",
    };
  }
  if (code === "REVENUE_COVERAGE_MISMATCH") {
    return {
      title: "صافي التحصيل لا يطابق سجل معاملات العملاء",
      detail:
        "يوجد فرق أكبر من حد التحمّل بين صافي كاش البزنس والتحصيل المشتق من المعاملات. راجع الشهر بدل إضافة رقم تعويضي.",
    };
  }
  if (code === "BUSINESS_NET_CASH_MISSING") {
    return {
      title: "صافي التحصيل الشهري غير مكتمل",
      detail: "أكمل الإيرادات والمرتجعات الفعلية لهذا الشهر حتى يستطيع ميزان مقارنة تغطية معاملات العملاء.",
    };
  }
  if (code === "NO_NEW_CUSTOMERS") {
    return {
      title: "تكلفة اكتساب في شهر بلا عملاء جدد",
      detail:
        "لا ينقل ميزان تكلفة الاكتساب تلقائيًا إلى شهر آخر. إذا كان لديك دليل تاريخي موثوق، يمكنك توزيع نفس التكلفة على شهور أول شراء أدناه.",
    };
  }
  if (code === "NO_PAYING_CUSTOMERS") {
    return {
      title: "تكلفة مرتبطة بعملاء دافعين لكن لا يوجد أساس توزيع آمن",
      detail: "لا توجد أوزان موثوقة كافية لتوزيع هذه التكلفة تلقائيًا، لذلك بقيت غير موزعة.",
    };
  }
  if (code === "NO_POSITIVE_COLLECTED_CASH") {
    return {
      title: "تكلفة مرتبطة بالتحصيل لكن لا يوجد تحصيل موجب صالح للتوزيع",
      detail: "ميزان لا يستخدم المرتجعات كأوزان سالبة ولا يخمّن أساس توزيع بديل.",
    };
  }
  if (code === "LEGACY_MANUAL_UNRECONCILED") {
    return {
      title: "توزيع يدوي قديم غير مربوط بمصروف فعلي",
      detail: "تم حفظ السجل القديم للمراجعة، لكنه لا يدخل في الربحية حتى يتم ربطه بتكلفة تاريخية فعلية بنفس القيمة والنوع.",
    };
  }
  if (code === "COST_RECONCILIATION_FAILED") {
    return {
      title: "تكلفة لا تتطابق حسابيًا بعد التوزيع",
      detail: "التكلفة الموزعة وغير الموزعة لا تساوي مصدر التكلفة الفعلي بالضبط، لذلك بقيت الحالة غير مكتملة.",
    };
  }
  if (code.startsWith("MANUAL_OVERRIDE_")) {
    return {
      title: "توزيع يدوي سابق لم يعد صالحًا",
      detail: "تغيّر مصدر التكلفة أو بيانات الاعتماد بعد إنشاء التوزيع. راجع المصدر وأعد التوزيع فقط إذا كان لديك دليل موثوق.",
    };
  }
  return {
    title: "بيانات تحتاج مراجعة",
    detail: "ميزان لم يجد أساسًا آمنًا لإكمال هذه الجزئية تلقائيًا، لذلك أبقاها واضحة بدل افتراض رقم.",
  };
}

function expectedCategory(costType: string) {
  if (costType === "acquisition") return "acquisition";
  if (costType === "variable_fulfillment") return "fulfillment";
  if (costType === "other_variable") return "overhead";
  if (costType === "payment_processing") return "financial";
  return null;
}

function legacyTypeLabel(costType: string) {
  if (costType === "acquisition") return "اكتساب";
  if (costType === "variable_fulfillment") return "تنفيذ متغير";
  if (costType === "other_variable") return "تكلفة متغيرة أخرى";
  if (costType === "payment_processing") return "تكلفة مالية متغيرة";
  return costType;
}

/** Renders the founder-facing review queue without weakening the database reconciliation rules. */
export function CustomerEconomicsReviewPanel({
  businessId,
  baseCurrency,
  canManage,
  exceptions,
  trustedMonths,
  legacyAllocations,
  eligibleCostPools,
  statusMessage = null,
  statusIsError = false,
}: Props) {
  const legacyGroups = [...new Set(legacyAllocations.map((row) => row.cost_type))];

  return (
    <div className={styles.workspace}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Customer Economics</span>
          <h1>ملاحظات تحتاج مراجعتك</h1>
          <p>
            هذه الصفحة تظهر فقط الأشياء التي لم يستطع ميزان حسمها بأمان. لا يتم إنشاء مصروفات جديدة هنا؛ أي توزيع يدوي يعيد توزيع تكلفة فعلية موجودة بالفعل.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondaryAction} href={`/businesses/${businessId}/customers`}>
            العودة لاقتصاديات العميل
          </Link>
          <Link className={styles.secondaryAction} href={`/businesses/${businessId}/monthly/correction`}>
            تصحيح شهر سابق
          </Link>
        </div>
      </section>

      {statusMessage && (
        <div className={statusIsError ? styles.errorStatus : styles.successStatus} role="status">
          {statusMessage}
        </div>
      )}

      {!canManage && (
        <div className={styles.readOnlyNotice}>
          لديك صلاحية عرض فقط. يمكنك مراجعة سبب كل ملاحظة، لكن التعديل متاح لمالك البزنس أو الأدمن فقط.
        </div>
      )}

      {exceptions.length === 0 ? (
        <section className={styles.cleanState} aria-label="حالة مراجعة اقتصاديات العميل">
          <span className={styles.cleanMark} aria-hidden="true">✓</span>
          <div>
            <h2>لا يوجد شيء يحتاج مراجعتك</h2>
            <p>كل نطاقات اقتصاديات العميل المتاحة حاليًا إمّا مكتملة أو موزعة بالقواعد المعتمدة.</p>
          </div>
        </section>
      ) : (
        <section className={styles.queue} aria-label="ملاحظات اقتصاديات العميل التي تحتاج مراجعة">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>المراجعة الحالية</span>
              <h2>{exceptions.length} ملاحظة تحتاج قرارًا أو استكمال بيانات</h2>
            </div>
            <span className={styles.blockingBadge}>تمنع اعتبار النطاق مكتملًا</span>
          </div>

          <div className={styles.exceptionList}>
            {exceptions.map((exception, index) => {
              const copy = exceptionCopy(exception.exception_code);
              const currency = exception.currency ?? baseCurrency;
              const key = `${exception.exception_code}:${exception.authoritative_source_id ?? "none"}:${exception.activity_month ?? "all"}:${index}`;
              return (
                <article className={styles.exceptionCard} key={key}>
                  <div className={styles.exceptionTop}>
                    <div>
                      <span className={styles.monthBadge}>{monthLabel(exception.activity_month)}</span>
                      <h3>{copy.title}</h3>
                    </div>
                    {exception.amount !== null && (
                      <strong className={styles.amount} dir="ltr">
                        {money(exception.amount, currency)}
                      </strong>
                    )}
                  </div>
                  {exception.expense_name_snapshot && (
                    <p className={styles.sourceName}>البند: {exception.expense_name_snapshot}</p>
                  )}
                  <p>{copy.detail}</p>
                  <small className={styles.technicalCode} dir="ltr">{exception.exception_code}</small>

                  {exception.exception_code === "INCOMPLETE_TRANSACTION_HISTORY" && (
                    <Link className={styles.inlineAction} href={`/businesses/${businessId}/customers/import`}>
                      مراجعة سجل المعاملات
                    </Link>
                  )}

                  {(exception.exception_code === "REVENUE_COVERAGE_MISMATCH" ||
                    exception.exception_code === "BUSINESS_NET_CASH_MISSING") &&
                    exception.activity_month && (
                      <Link
                        className={styles.inlineAction}
                        href={`/businesses/${businessId}/monthly?month=${exception.activity_month.slice(0, 7)}`}
                      >
                        فتح بيانات هذا الشهر
                      </Link>
                    )}

                  {canManage &&
                    exception.can_manual_override &&
                    exception.authoritative_source_id &&
                    trustedMonths.length > 0 && (
                      <details className={styles.overrideBox}>
                        <summary>لدي دليل موثوق — توزيع نفس التكلفة يدويًا</summary>
                        <form action={saveCustomerEconomicsManualOverride} className={styles.overrideForm}>
                          <input type="hidden" name="business_id" value={businessId} />
                          <input
                            type="hidden"
                            name="authoritative_source_id"
                            value={exception.authoritative_source_id}
                          />
                          <div className={styles.safetyNote}>
                            يجب أن يساوي مجموع التوزيع التكلفة الفعلية بالضبط: <strong dir="ltr">{money(exception.amount, currency)}</strong>. إذا لم تكن متأكدًا، اترك الملاحظة غير مكتملة.
                          </div>
                          <div className={styles.allocationGrid}>
                            {trustedMonths.map((month) => (
                              <label key={month.cohortMonth}>
                                <span>{monthLabel(month.cohortMonth)}</span>
                                <input type="hidden" name="cohort_month" value={month.cohortMonth} />
                                <div className={styles.inputShell} dir="ltr">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    name="allocation_amount"
                                    placeholder="0"
                                    aria-label={`المبلغ الموزع على ${monthLabel(month.cohortMonth)}`}
                                  />
                                  <small>{currency}</small>
                                </div>
                              </label>
                            ))}
                          </div>
                          <label className={styles.reasonField}>
                            <span>سبب التوزيع والدليل الذي تعتمد عليه</span>
                            <textarea name="reason" maxLength={500} required />
                          </label>
                          <button type="submit" className={styles.primaryAction}>
                            حفظ التوزيع الاستثنائي
                          </button>
                        </form>
                      </details>
                    )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {legacyAllocations.length > 0 && (
        <section className={styles.legacySection} aria-labelledby="legacy-review-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>سجل قديم محفوظ للمراجعة</span>
              <h2 id="legacy-review-title">ربط التوزيعات اليدوية القديمة بمصروف فعلي</h2>
            </div>
          </div>
          <p className={styles.sectionCopy}>
            هذه الأرقام لا تدخل تلقائيًا في الربحية. اختر فقط السجلات التي تعرف أنها كانت توزيعًا لنفس بند المصروف التاريخي، ويجب أن يساوي مجموعها قيمة ذلك المصروف بالضبط.
          </p>

          <div className={styles.legacyGroups}>
            {legacyGroups.map((costType) => {
              const rows = legacyAllocations.filter((row) => row.cost_type === costType);
              const category = expectedCategory(costType);
              const pools = eligibleCostPools.filter((pool) => pool.category_snapshot === category);
              return (
                <form
                  action={reconcileCustomerEconomicsLegacyAllocations}
                  className={styles.legacyCard}
                  key={costType}
                >
                  <input type="hidden" name="business_id" value={businessId} />
                  <div className={styles.legacyCardHeader}>
                    <h3>{legacyTypeLabel(costType)}</h3>
                    <span>{rows.length} سجل</span>
                  </div>
                  <div className={styles.legacyRows}>
                    {rows.map((row) => (
                      <label className={styles.legacyRow} key={row.id}>
                        <input
                          type="checkbox"
                          name="legacy_allocation_id"
                          value={row.id}
                          disabled={!canManage}
                        />
                        <span>
                          <strong>{monthLabel(row.cohort_month)}</strong>
                          {row.note && <small>{row.note}</small>}
                        </span>
                        <b dir="ltr">{money(row.amount, baseCurrency)}</b>
                      </label>
                    ))}
                  </div>
                  {canManage && pools.length > 0 ? (
                    <>
                      <label className={styles.selectField}>
                        <span>المصروف التاريخي الفعلي الذي كانت هذه السجلات توزعه</span>
                        <select name="authoritative_source_id" required defaultValue="">
                          <option value="" disabled>اختر بند المصروف</option>
                          {pools.map((pool) => (
                            <option value={pool.authoritative_source_id} key={pool.authoritative_source_id}>
                              {`${monthLabel(pool.activity_month)} — ${pool.expense_name_snapshot} — ${money(pool.authoritative_amount, pool.currency ?? baseCurrency)}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.reasonField}>
                        <span>سبب الربط</span>
                        <textarea name="reason" maxLength={500} required />
                      </label>
                      <button type="submit" className={styles.primaryAction}>
                        ربط السجلات بالمصروف الفعلي
                      </button>
                    </>
                  ) : canManage ? (
                    <p className={styles.safetyNote}>لا يوجد حاليًا مصروف فعلي مؤهل من نفس النوع يمكن ربط هذه السجلات به.</p>
                  ) : null}
                </form>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.correctionCallout}>
        <div>
          <span className={styles.eyebrow}>التاريخ لا يتغير بصمت</span>
          <h2>هل تحتاج تعديل شهر قديم؟</h2>
          <p>استخدم مسار التصحيح التاريخي. ميزان يحفظ سبب التعديل ونسخة قبل وبعد، ولا يطبق أي تغيير على بقية الشهور.</p>
        </div>
        <Link className={styles.primaryAction} href={`/businesses/${businessId}/monthly/correction`}>
          فتح تصحيح شهر سابق
        </Link>
      </section>
    </div>
  );
}
