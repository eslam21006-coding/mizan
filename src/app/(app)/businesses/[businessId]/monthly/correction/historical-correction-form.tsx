import Link from "next/link";
import {
  MonthlyEntryForm,
  type ExpenseInputRow,
  type MonthlyPeriodValues,
  type RevenueInputRow,
} from "../monthly-entry-form";
import saveBarStyles from "../monthly-save-bar.module.css";
import monthlyStyles from "../monthly.module.css";
import trustStyles from "../customer-history-trust.module.css";
import { correctHistoricalMonthlyActuals } from "./actions";
import styles from "./historical-correction.module.css";

type Props = {
  businessId: string;
  monthKey: string;
  monthLabel: string;
  currency: string;
  revenueRows: RevenueInputRow[];
  expenseRows: ExpenseInputRow[];
  period: MonthlyPeriodValues;
  canEdit: boolean;
  payingCustomersDerived: boolean;
  newCustomersDerived: boolean;
  payingCustomersCount: number | null;
};

/** Presents one existing historical month as an explicit, reasoned, auditable correction. */
export function HistoricalCorrectionForm({
  businessId,
  monthKey,
  monthLabel,
  currency,
  revenueRows,
  expenseRows,
  period,
  canEdit,
  payingCustomersDerived,
  newCustomersDerived,
  payingCustomersCount,
}: Props) {
  const payingOnlyDerived = payingCustomersDerived && !newCustomersDerived;
  const trustNotice = payingOnlyDerived ? (
    <div className={trustStyles.trustNotice} role="status">
      <strong>إجمالي العملاء الذين دفعوا خلال الشهر محسوب من سجل المعاملات</strong>
      <span className={trustStyles.trustValue} dir="ltr">{payingCustomersCount ?? 0}</span>
      <p>
        «العملاء الجدد» يظل قابلًا للتصحيح اليدوي لأن سجل المعاملات غير مؤكد من بداية البزنس. ميزان لا يعتبر أول معاملة مرفوعة أول شراء حقيقي بدون دليل.
      </p>
      <Link className={trustStyles.trustLink} href={`/businesses/${businessId}/customers/import`}>
        مراجعة اكتمال سجل المعاملات
      </Link>
    </div>
  ) : null;

  if (!canEdit) {
    return (
      <div className={monthlyStyles.monthForm}>
        {trustNotice}
        <MonthlyEntryForm
          editable={false}
          currency={currency}
          revenueRows={revenueRows}
          expenseRows={expenseRows}
          period={period}
          customerCountsDerived={newCustomersDerived}
        />
        <div className={styles.readOnlyNotice}>هذه البيانات للعرض فقط حسب صلاحيتك الحالية.</div>
      </div>
    );
  }

  return (
    <form
      action={correctHistoricalMonthlyActuals}
      className={`${monthlyStyles.monthForm} ${payingOnlyDerived ? trustStyles.payingDerivedOnly : ""}`}
    >
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="month" value={monthKey} />
      {trustNotice}
      <MonthlyEntryForm
        editable
        currency={currency}
        revenueRows={revenueRows}
        expenseRows={expenseRows}
        period={period}
        customerCountsDerived={newCustomersDerived}
      />

      <section className={styles.auditSection} aria-labelledby="historical-correction-reason">
        <div>
          <span className={styles.eyebrow}>سجل التعديل</span>
          <h2 id="historical-correction-reason">لماذا يتم تعديل هذا الشهر؟</h2>
          <p>
            السبب إلزامي. ميزان يحفظ نسخة قبل وبعد التصحيح مع المستخدم والتوقيت، ولا يغير أي شهر آخر تلقائيًا.
          </p>
        </div>
        <label className={styles.reasonField}>
          <span>سبب التصحيح</span>
          <textarea
            name="correction_reason"
            maxLength={500}
            required
            placeholder="مثال: وصل كشف بوابة الدفع النهائي بعد إغلاق الشهر وتم تصحيح المرتجعات الفعلية."
          />
        </label>
      </section>

      <div className={`${monthlyStyles.saveBar} ${saveBarStyles.mobileSafeSaveBar}`}>
        <div>
          <strong>حفظ تصحيح {monthLabel}</strong>
          <p>سيتم تسجيل قبل/بعد وسبب التصحيح. لا يوجد تطبيق تلقائي على الشهور الأخرى.</p>
        </div>
        <button type="submit">حفظ التصحيح التاريخي</button>
      </div>
    </form>
  );
}
