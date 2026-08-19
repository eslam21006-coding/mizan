import styles from "./monthly.module.css";

export default function MonthlyLoading() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="جاري تحميل بيانات الشهر">
      <div className={styles.section}>
        <strong>جاري تحميل بيانات الشهر…</strong>
      </div>
      <div className={styles.section}>
        <p className={styles.emptyText}>جاري تجهيز الإيراد والمرتجعات والمصروفات.</p>
      </div>
    </div>
  );
}
