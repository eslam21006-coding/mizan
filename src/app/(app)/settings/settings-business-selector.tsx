import Link from "next/link";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/business/onboarding";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import styles from "../businesses/businesses.module.css";

export type SettingsBusiness = {
  id: string;
  name: string;
  baseCurrency: string;
  timezone: string;
};

/** Resolves the human-readable configured currency without changing stored business identity. */
function currencyLabel(code: string) {
  return CURRENCY_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

/** Resolves the human-readable configured timezone without changing stored business identity. */
function timezoneLabel(timezone: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

/** Renders one Settings selector action per business and no competing management actions. */
export function SettingsBusinessSelector({ businesses }: { businesses: readonly SettingsBusiness[] }) {
  return (
    <section className={styles.grid} aria-label="اختيار بزنس للإعدادات">
      {businesses.map((business) => (
        <article
          className={styles.businessCard}
          key={business.id}
          aria-label={`إعدادات بزنس ${business.name}`}
        >
          <div className={styles.cardTopline}>
            <span className={styles.status}>إعدادات البزنس</span>
            <span className={styles.currencyCode}>{business.baseCurrency}</span>
          </div>
          <h2>{business.name}</h2>
          <dl className={styles.metaList}>
            <div>
              <dt>العملة الأساسية</dt>
              <dd>
                {business.baseCurrency} — {currencyLabel(business.baseCurrency)}
              </dd>
            </div>
            <div>
              <dt>المنطقة الزمنية</dt>
              <dd>{timezoneLabel(business.timezone)}</dd>
            </div>
          </dl>
          <div className={styles.nextStep}>
            <p>افتح إعدادات هذا البزنس لمراجعة هويته والوصول إلى الإجراءات الخاصة به.</p>
            <Link
              className={styles.openBusinessButton}
              href={resolveNavigationDestination({
                route: "business-settings",
                businessId: business.id,
              })}
            >
              فتح إعدادات البزنس
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
