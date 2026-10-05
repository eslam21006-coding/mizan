import Link from "next/link";
import { MonthlyEntryForm } from "../monthly/monthly-entry-form";
import {
  parseMonthKey,
  shiftMonthKey,
} from "@/lib/business/monthly";
import { buildBusinessSetupHref } from "@/lib/business/setup-navigation";
import type { FirstMonthSetupResult } from "@/lib/business/first-month-setup";
import { FirstMonthPicker } from "./first-month-picker";
import { FirstMonthSaveForm } from "./first-month-save-form";
import type { FirstMonthSaveState } from "./first-month-actions";
import type { FirstMonthPostSaveStatus } from "@/lib/business/first-month-post-save";
import styles from "./first-month-setup.module.css";

type FirstMonthSetupContentProps = {
  businessId: string;
  baseCurrency: string;
  canManage: boolean;
  latestSavedMonthKey: string | null;
  firstMonth: FirstMonthSetupResult;
  invalidMonth: boolean;
  monthSaved?: boolean;
  postSaveStatus?: FirstMonthPostSaveStatus | null;
  firstMonthSaveSeed?: FirstMonthSaveState;
};

/** Presents the selected month with authorized editing and protected historical snapshots. */
export function FirstMonthSetupContent({
  businessId,
  baseCurrency,
  canManage,
  latestSavedMonthKey,
  firstMonth,
  invalidMonth,
  monthSaved = false,
  postSaveStatus = null,
  firstMonthSaveSeed,
}: FirstMonthSetupContentProps) {
  const monthKey = firstMonth.selectedMonthKey;
  const persistedMonth = firstMonth.kind === "loaded" && firstMonth.hasSavedPeriod;
  const completeSavedMonth = persistedMonth && firstMonth.completeness?.complete === true;
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
        <FirstMonthPicker businessId={businessId} monthKey={monthKey} />
      </section>

      {postSaveStatus === "verification-unavailable" ? (
        <div role="status" className={styles.unsavedNotice}>
          {persistedMonth
            ? "الشهر محفوظ، لكن تعذر التحقق من جاهزية النتيجة. أعد تحميل الصفحة لمراجعة الأرقام، ولن نعرض نتائج غير مؤكدة."
            : "تعذر تأكيد حالة الحفظ. أعد تحميل الصفحة للتحقق من البيانات، ولن نعرض نتائج غير مؤكدة."}
        </div>
      ) : postSaveStatus === "result-unavailable" && completeSavedMonth ? (
        <div role="status" className={styles.unsavedNotice}>
          <strong>تم الحفظ، لكن نتيجة الشهر غير جاهزة بعد.</strong>
          <p>راجع التحصيل والمرتجعات، بما فيها المبالغ غير المنسوبة، وأكّد الصفر إذا كانت القيمة الفعلية صفرًا.</p>
          <Link
            href={firstMonth.kind === "loaded" && firstMonth.isSavedHistorical
              ? `/businesses/${encodeURIComponent(businessId)}/monthly/correction?month=${encodeURIComponent(monthKey)}`
              : monthlyEditorHref}
          >
            مراجعة بيانات الشهر
          </Link>
        </div>
      ) : postSaveStatus === "setup-incomplete" && completeSavedMonth ? (
        <div role="status" className={styles.unsavedNotice}>
          <strong>تم حفظ الشهر والتحقق من اكتماله.</strong>
          <p>لا تزال هناك خطوة أخرى في إعداد البزنس تحتاج إلى إكمال قبل عرض النتائج.</p>
          <Link href={buildBusinessSetupHref(businessId, undefined, { monthKey })}>أكمل خطوات الإعداد</Link>
        </div>
      ) : monthSaved && firstMonth.kind === "loaded" && firstMonth.hasSavedPeriod ? (
        <div role="status" className={firstMonth.completeness?.complete ? styles.savedNotice : styles.unsavedNotice}>
          {firstMonth.completeness?.complete
            ? "تم حفظ الشهر بنجاح، وأصبحت بياناته مكتملة."
            : "تم حفظ بيانات الشهر. ما زالت بعض الأرقام مطلوبة قبل اكتمال هذه الخطوة."}
        </div>
      ) : null}
      {firstMonth.kind === "loaded" && firstMonth.hasSavedPeriod && !firstMonth.completeness?.complete ? (
        <p className={styles.trustNotice} role="note">
          الشهر محفوظ لكنه غير مكتمل ماليًا. أضف القيم الناقصة، واكتب صفرًا إذا كانت القيمة الفعلية صفرًا.
        </p>
      ) : null}

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
              <strong>احفظ أرقامك مباشرة من هذه الخطوة</strong>
              <p>بعد حفظ شهر غير مكتمل يمكنك مغادرة الإعداد والعودة إليه لاحقًا. التغييرات التي لم تحفظها لا تُستعاد تلقائيًا. لا تكتمل الخطوة إلا بعد تأكيد جميع القيم المطلوبة؛ الصفر المؤكد يختلف عن الخانة الفارغة.</p>
              <Link href={monthlyEditorHref} className={styles.openMonthly}>فتح الإدخال الشهري</Link>
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

          {canManage && !firstMonth.isSavedHistorical ? (
            <FirstMonthSaveForm
              key={monthKey}
              businessId={businessId}
              monthKey={monthKey}
              currency={baseCurrency}
              firstMonth={firstMonth}
              seedState={firstMonthSaveSeed}
            />
          ) : (
            <section className={styles.formPreview} aria-label="معاينة إدخال أول شهر">
              <MonthlyEntryForm
                key={monthKey}
                editable={false}
                currency={baseCurrency}
                revenueRows={firstMonth.revenueRows}
                expenseRows={firstMonth.expenseRows}
                period={firstMonth.period}
                customerCountsDerived={firstMonth.payingCustomersDerived}
                newCustomersDerived={firstMonth.newCustomersDerived}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
