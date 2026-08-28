import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/business/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";

function currencyLabel(code: string) {
  return CURRENCY_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

function timezoneLabel(timezone: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <PageHeading
        title="الإعدادات"
        description="راجع إعدادات كل بزنس وافتح مباشرةً الأماكن التي تغيّر هيكل الإيراد والمصروفات والفانلز والعملاء."
      />

      {error ? (
        <section className={styles.errorPanel}>
          <strong>تعذر تحميل إعدادات البزنسات</strong>
          <p>لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="إعدادات البزنسات">
          {businesses.map((business) => (
            <article className={styles.businessCard} key={business.id}>
              <div className={styles.cardTopline}>
                <span className={styles.status}>إعدادات البزنس</span>
                <span className={styles.currencyCode}>{business.base_currency}</span>
              </div>
              <h2>{business.name}</h2>
              <dl className={styles.metaList}>
                <div>
                  <dt>العملة الأساسية</dt>
                  <dd>
                    {business.base_currency} — {currencyLabel(business.base_currency)}
                  </dd>
                </div>
                <div>
                  <dt>المنطقة الزمنية</dt>
                  <dd>{timezoneLabel(business.timezone)}</dd>
                </div>
              </dl>
              <div className={styles.nextStep}>
                <p>
                  العملة الأساسية لا تتغير من هذه الصفحة في V1 لأن تغييرها بعد وجود تاريخ مالي قد
                  يخلط أرقامًا بعملات مختلفة. استخدم الروابط التالية لإدارة الهيكل الفعلي للبزنس.
                </p>
                <div className={styles.manageLinks}>
                  <Link
                    className={styles.manageLink}
                    href={`/businesses/${business.id}/revenue-streams`}
                  >
                    مصادر الإيراد
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/expenses`}>
                    هيكل المصروفات
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/funnels`}>
                    الفانلز
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/customers`}>
                    العملاء و LTV
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/monthly`}>
                    الأرقام الشهرية
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <div>
            <span className={styles.kicker}>لا توجد إعدادات بعد</span>
            <h2>أضف بزنسًا أولًا</h2>
            <p>إعدادات العملة والمنطقة الزمنية وهيكل البزنس ترتبط بكل بزنس بصورة مستقلة.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
