import Link from "next/link";
import styles from "./liquidation.module.css";

type LiquidationMissingDataActionsProps = {
  businessId: string;
  monthKey: string;
  revenueIncomplete: boolean;
  adSpendMissing: boolean;
  allocationIncomplete: boolean;
};

/** Renders only deterministic fix actions for Liquidation inputs that are known to be missing. */
export function LiquidationMissingDataActions({
  businessId,
  monthKey,
  revenueIncomplete,
  adSpendMissing,
  allocationIncomplete,
}: LiquidationMissingDataActionsProps) {
  if (!revenueIncomplete && !adSpendMissing && !allocationIncomplete) {
    return null;
  }

  return (
    <section className={styles.missingDataPanel} aria-label="بيانات ناقصة لتحليل التسييل">
      <div>
        <span className={styles.kicker}>أكمل البيانات الناقصة</span>
        <h2>ميزان يعرف أين تحتاج أن تصلح الرقم</h2>
        <p>استخدم الإجراء المباشر لكل نقص بدل التنقل يدويًا بين الأقسام.</p>
      </div>

      <div className={styles.missingDataList}>
        {revenueIncomplete && (
          <article className={styles.missingDataItem}>
            <div>
              <strong>بيانات Front-End الشهرية غير مكتملة</strong>
              <p>أكمل الإيراد المحصل والمرتجعات لمصادر Front-End في نفس الشهر.</p>
            </div>
            <Link href={`/businesses/${businessId}/monthly?month=${monthKey}`}>
              فتح الإدخال الشهري
            </Link>
          </article>
        )}

        {adSpendMissing && (
          <article className={styles.missingDataItem}>
            <div>
              <strong>Total Ad Spend غير متاح</strong>
              <p>أدخل أو أكمل الإنفاق الإعلاني المعتمد في أرقام الفانلز لنفس الشهر.</p>
            </div>
            <Link href={`/businesses/${businessId}/funnels/monthly?month=${monthKey}`}>
              فتح أرقام الفانلز
            </Link>
          </article>
        )}

        {allocationIncomplete && (
          <article className={styles.missingDataItem}>
            <div>
              <strong>توزيع تكاليف Front-End غير مكتمل</strong>
              <p>أكمل التوزيع هنا في نفس الصفحة بدل مغادرة تحليل التسييل.</p>
            </div>
            <a href="#front-end-allocations">إكمال التوزيع</a>
          </article>
        )}
      </div>
    </section>
  );
}
