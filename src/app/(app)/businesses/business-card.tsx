import Link from "next/link";
import styles from "./businesses.module.css";

export type BusinessCardViewModel = {
  id: string;
  name: string;
  baseCurrency: string;
  currencyLabel: string;
  timezoneLabel: string;
};

/** Presents business identity and one clear entry point into its dashboard. */
export function BusinessCard({ business }: { business: BusinessCardViewModel }) {
  const dashboardQuery = new URLSearchParams({ business: business.id });

  return (
    <article className={styles.businessCard}>
      <div className={styles.cardTopline}>
        <span className={styles.status}>جاهز للمتابعة</span>
        <span className={styles.currencyCode}>{business.baseCurrency}</span>
      </div>

      <h2>{business.name}</h2>

      <dl className={styles.metaList}>
        <div>
          <dt>العملة الأساسية</dt>
          <dd>
            {business.baseCurrency} — {business.currencyLabel}
          </dd>
        </div>
        <div>
          <dt>المنطقة الزمنية</dt>
          <dd>{business.timezoneLabel}</dd>
        </div>
      </dl>

      <Link className={styles.openBusinessButton} href={`/?${dashboardQuery.toString()}`}>
        فتح البزنس
      </Link>
    </article>
  );
}
