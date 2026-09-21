import Link from "next/link";
import { buildBusinessWorkspaceHref } from "@/lib/business-workspace";
import styles from "./businesses.module.css";

export type BusinessCardViewModel = {
  id: string;
  name: string;
  baseCurrency: string;
  currencyLabel: string;
  timezoneLabel: string;
};

/** Presents business identity and one clear entry point into its workspace. */
export function BusinessCard({ business }: { business: BusinessCardViewModel }) {
  return (
    <article className={styles.businessCard} aria-label={`بزنس ${business.name}`}>
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

      <Link className={styles.openBusinessButton} href={buildBusinessWorkspaceHref(business.id, "overview")}>
        فتح البزنس
      </Link>
    </article>
  );
}
