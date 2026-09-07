import type { TransactionImportCompletionSummary } from "@/lib/business/transaction-import-completion";
import styles from "./transaction-import-completion-card.module.css";

type TransactionImportCompletionCardProps = {
  businessId: string;
  baseCurrency: string;
  insertedCount: number;
  duplicateCount: number;
  ignoredDetailRows: number;
  invalidRows: number;
  summary: TransactionImportCompletionSummary;
};

function dateRange(firstDate: string | null, lastDate: string | null) {
  if (!firstDate || !lastDate) return "—";
  return firstDate === lastDate ? firstDate : `${firstDate} ← ${lastDate}`;
}

/** Shows import completion only after the server has verified the persisted transaction rows. */
export function TransactionImportCompletionCard({
  businessId,
  baseCurrency,
  insertedCount,
  duplicateCount,
  ignoredDetailRows,
  invalidRows,
  summary,
}: TransactionImportCompletionCardProps) {
  const hasNewRows = insertedCount > 0;

  return (
    <section
      className={styles.completionPanel}
      data-new-rows={hasNewRows ? "true" : "false"}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>اكتمل الاستيراد</span>
          <h3>{hasNewRows ? "تم حفظ معاملاتك والتحقق منها" : "لم تتم إضافة معاملات جديدة"}</h3>
          <p>
            {hasNewRows
              ? `تحقق ميزان من وجود ${summary.persistedInsertedCount} معاملة جديدة في قاعدة البيانات قبل عرض هذه النتيجة.`
              : "تمت معالجة الملف بنجاح، لكن كل المعاملات كانت موجودة بالفعل أو تم تأكيدها كمكررة؛ لم يتم إنشاء معاملات جديدة."}
          </p>
        </div>
        <span className={styles.verifiedBadge}>تم التحقق من الحفظ</span>
      </div>

      <div className={styles.summaryGrid}>
        <div>
          <span>معاملات جديدة</span>
          <strong>{insertedCount}</strong>
        </div>
        <div>
          <span>مكررة مؤكدة</span>
          <strong>{duplicateCount}</strong>
        </div>
        <div>
          <span>صفوف تفاصيل تم تجاهلها</span>
          <strong>{ignoredDetailRows}</strong>
        </div>
        <div>
          <span>صفوف غير صالحة تم تجاهلها</span>
          <strong>{invalidRows}</strong>
        </div>
        <div>
          <span>إجمالي المعاملات المحفوظة</span>
          <strong>{summary.businessTransactionCount}</strong>
        </div>
        <div>
          <span>إجمالي العملاء المسجلين</span>
          <strong>{summary.businessUniqueCustomerCount}</strong>
        </div>
        <div>
          <span>صافي التحصيل من سجل المعاملات</span>
          <strong dir="ltr">
            {baseCurrency} {summary.businessNetCashCollected}
          </strong>
        </div>
        <div>
          <span>نطاق سجل المعاملات</span>
          <strong dir="ltr">
            {dateRange(summary.businessFirstTransactionDate, summary.businessLastTransactionDate)}
          </strong>
        </div>
      </div>

      {invalidRows > 0 && (
        <div className={styles.sessionNote}>
          <strong>الصفوف غير الصالحة لم تدخل في الاستيراد.</strong>
          <span>لم تُحفظ ولم تدخل في أي حسابات للعملاء أو التحصيل.</span>
        </div>
      )}

      {hasNewRows && (
        <div className={styles.sessionNote}>
          <strong>المضاف في هذه العملية:</strong>
          <span>{summary.sessionUniqueCustomerCount} عميل فريد</span>
          <span dir="ltr">
            Net Cash: {baseCurrency} {summary.sessionNetCashCollected}
          </span>
          <span dir="ltr">
            {dateRange(summary.sessionFirstTransactionDate, summary.sessionLastTransactionDate)}
          </span>
        </div>
      )}

      <div className={styles.nextStep}>
        <div>
          <strong>الخطوة التالية</strong>
          <p>
            افتح تحليل العملاء؛ العملاء و Cohorts و Observed LTV تُقرأ من سجل المعاملات المحفوظ فعلًا.
          </p>
        </div>
        <a className={styles.primaryAction} href={`/businesses/${businessId}/customers`}>
          عرض تحليل العملاء
        </a>
      </div>
    </section>
  );
}
