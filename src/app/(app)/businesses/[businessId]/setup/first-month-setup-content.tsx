import Link from "next/link";
import { MonthlyEntryForm } from "../monthly/monthly-entry-form";
import {
  parseMonthKey,
  shiftMonthKey,
} from "@/lib/business/monthly";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import type { FirstMonthSetupResult } from "@/lib/business/first-month-setup";
import styles from "./first-month-setup.module.css";

type FirstMonthSetupContentProps = {
  businessId: string;
  baseCurrency: string;
  canManage: boolean;
  latestSavedMonthKey: string | null;
  firstMonth: FirstMonthSetupResult;
  invalidMonth: boolean;
};

/** Displays a deliberately unsaved first-month preview over the canonical Monthly entry form. */
export function FirstMonthSetupContent({
  businessId,
  baseCurrency,
  canManage,
  latestSavedMonthKey,
  firstMonth,
  invalidMonth,
}: FirstMonthSetupContentProps) {
  const monthKey = firstMonth.selectedMonthKey;
  const previous = shiftMonthKey(monthKey, -1);
  const next = shiftMonthKey(monthKey, 1);
  const previousMonth = previous && parseMonthKey(previous) ? previous : null;
  const nextMonth = next && parseMonthKey(next) ? next : null;
  const monthHref = (key: string) =>
    `${buildBusinessSetupHref(businessId, "month")}&month=${encodeURIComponent(key)}`;
  const monthLabel = new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-01T00:00:00.000Z`));
  const monthlyEditorHref = `/businesses/${encodeURIComponent(businessId)}/monthly?month=${encodeURIComponent(monthKey)}`;

  return (
    <div className={styles.firstMonth}>
      <div className={styles.intro}>
        <h3>أول شهر حقيقي</h3>
        <p>أدخل أرقام شهر فعلي حتى يستطيع ميزان تحليل أداء البزنس بناءً على التحصيلات والمصروفات الحقيقية.</p>
      </div>

      {invalidMonth ? (
        <p role="alert" className={styles.warning}>الشهر المطلوب غير صحيح. تم فتح الشهر الحالي بأمان.</p>
      ) : null}

      <section className={styles.monthChooser} aria-label="اختيار شهر الإعداد">
        <div className={styles.monthNavigation}>
          {previousMonth ? (
            <Link href={monthHref(previousMonth)} className={styles.monthLink}>الشهر السابق</Link>
          ) : <span />}
          <strong>{monthLabel}</strong>
          {nextMonth ? (
            <Link href={monthHref(nextMonth)} className={styles.monthLink}>الشهر التالي</Link>
          ) : <span />}
        </div>
        <form method="get" action={buildBusinessSetupHref(businessId)} className={styles.monthPicker}>
          <input type="hidden" name="step" value="month" />
          <label htmlFor="first-month-selection">انتقل مباشرة إلى شهر</label>
          <div className={styles.monthPickerControls}>
            <input
              id="first-month-selection"
              name="month"
              type="month"
              min="2000-01"
              max="2200-12"
              required
              defaultValue={monthKey}
              key={monthKey}
              aria-label="الشهر"
            />
            <button type="submit">فتح الشهر</button>
          </div>
        </form>
      </section>

      {firstMonth.kind === "load_error" ? (
        <div role="alert" className={styles.error}>
          تعذر تحميل بيانات هذا الشهر كاملة. لن يعرض ميزان أرقامًا مفترضة أو يسمح بالإدخال حتى تنجح القراءة.
        </div>
      ) : (
        <>
          <div className={styles.monthStatus} role="status">
            <span className={firstMonth.hasSavedPeriod ? styles.saved : styles.unsaved}>
              {firstMonth.hasSavedPeriod ? "بيانات الشهر محفوظة بالفعل" : "هذا الشهر غير محفوظ بعد"}
            </span>
            {firstMonth.isSavedHistorical && (
              <span className={styles.historical}>شهر تاريخي محفوظ — عرض فقط</span>
            )}
            {!canManage && <span className={styles.historical}>لا تملك صلاحية تعديل البيانات</span>}
          </div>

          {latestSavedMonthKey && latestSavedMonthKey !== monthKey ? (
            <div className={styles.existingMonth}>
              يوجد شهر محفوظ آخر: <Link href={monthHref(latestSavedMonthKey)}>{latestSavedMonthKey}</Link>.
              حالة اكتمال خطوة الإعداد تعتمد على بيانات الشهور المحفوظة، لا على مدخلات المعاينة.
            </div>
          ) : null}

          {canManage && !firstMonth.isSavedHistorical ? (
            <div className={styles.unsavedNotice} role="note">
              <strong>معاينة غير محفوظة</strong>
              <p>الخانات أدناه لتجهيز واجهة أول شهر فقط. لن تُحفظ القيم التي تدخلها هنا عند تغيير الشهر أو مغادرة الصفحة. الحفظ من داخل ميزان متاح الآن عبر صفحة الإدخال الشهري؛ سيتم ربط هذه الخطوة بالحفظ مباشرةً في B10.</p>
              <Link href={monthlyEditorHref} className={styles.openMonthly}>
                فتح الإدخال الشهري لحفظ الأرقام
              </Link>
            </div>
          ) : (
            <div className={styles.readOnlyNotice}>
              البيانات أدناه للعرض فقط. {firstMonth.isSavedHistorical
                ? "لتعديل شهر تاريخي محفوظ، استخدم مسار التصحيح المعتمد في الإدخال الشهري."
                : "التعديل والحفظ متاحان فقط لمالك البزنس أو الأدمن."}
              <Link href={monthlyEditorHref}>فتح الشهر في الإدخال الشهري</Link>
            </div>
          )}

          {firstMonth.payingCustomersDerived && !firstMonth.newCustomersDerived && (
            <p className={styles.trustNotice} role="note">
              إجمالي العملاء الذين دفعوا خلال الشهر محسوب من التحصيلات المستوردة. العملاء الجدد ما زالوا إدخالًا يدويًا لأن اكتمال تاريخ المعاملات لم يُؤكد.
            </p>
          )}

          <section className={styles.formPreview} aria-label="معاينة إدخال أول شهر">
            <MonthlyEntryForm
              key={monthKey}
              editable={canManage && !firstMonth.isSavedHistorical}
              currency={baseCurrency}
              revenueRows={firstMonth.revenueRows}
              expenseRows={firstMonth.expenseRows}
              period={firstMonth.period}
              customerCountsDerived={firstMonth.payingCustomersDerived}
              newCustomersDerived={firstMonth.newCustomersDerived}
            />
          </section>
        </>
      )}
    </div>
  );
}
