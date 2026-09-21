import styles from "./monthly.module.css";

type HistoricalCorrectionSuccessProps = {
  monthLabel: string;
};

/** Confirms a completed audited correction after returning to the exact historical month. */
export function HistoricalCorrectionSuccess({
  monthLabel,
}: HistoricalCorrectionSuccessProps) {
  return (
    <section
      className={styles.correctionSuccess}
      role="status"
      aria-label="تأكيد التصحيح التاريخي"
    >
      <strong>تم حفظ التصحيح التاريخي</strong>
      <p>
        تم تحديث {monthLabel} مع الاحتفاظ بسبب التصحيح ونسخة قبل وبعد. أنت الآن في العرض
        التاريخي للشهر.
      </p>
    </section>
  );
}
