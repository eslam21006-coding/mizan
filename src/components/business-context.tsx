import styles from "./business-context.module.css";

type BusinessContextProps = {
  businessName: string;
  baseCurrency: string;
  timezone: string;
};

export function BusinessContext({ businessName, baseCurrency, timezone }: BusinessContextProps) {
  return (
    <section className={styles.context} aria-label="سياق البزنس">
      <div className={styles.identity}>
        <span className={styles.label}>البزنس الحالي</span>
        <strong className={styles.businessName}>{businessName}</strong>
      </div>
      <div className={styles.metadata}>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>العملة</span>
          <bdi className={styles.metaValue} dir="ltr">
            {baseCurrency}
          </bdi>
        </span>
        <span className={styles.metaItem}>
          <span className={styles.metaLabel}>المنطقة الزمنية</span>
          <bdi className={styles.metaValue} dir="ltr">
            {timezone}
          </bdi>
        </span>
      </div>
    </section>
  );
}
