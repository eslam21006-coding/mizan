import Link from "next/link";
import styles from "./monthly.module.css";

type HistoricalMonthStateProps = {
  businessId: string;
  monthKey: string;
  monthLabel: string;
  canManage: boolean;
};

/** Marks an already-saved past month as historical and routes edits into the audited correction workflow. */
export function HistoricalMonthState({
  businessId,
  monthKey,
  monthLabel,
  canManage,
}: HistoricalMonthStateProps) {
  const correctionHref = `/businesses/${businessId}/monthly/correction?month=${monthKey}`;

  return (
    <section className={styles.historicalPanel} aria-label="حالة الشهر التاريخي">
      <div>
        <span className={styles.historicalBadge}>شهر تاريخي</span>
        <strong>بيانات {monthLabel} محفوظة كسجل تاريخي</strong>
        <p>
          العرض هنا للرجوع والمراجعة فقط. أي تغيير على هذا الشهر يجب أن يتم من مسار تصحيح
          تاريخي صريح حتى يُحفظ السبب ونسخة قبل وبعد.
        </p>
      </div>
      {canManage ? (
        <Link className={styles.historicalAction} href={correctionHref}>
          بدء تصحيح تاريخي
        </Link>
      ) : (
        <span className={styles.historicalReadOnly}>عرض فقط</span>
      )}
    </section>
  );
}
