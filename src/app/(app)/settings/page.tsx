import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/business/onboarding";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";
import settingsStyles from "./settings.module.css";

type SettingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

/** Resolves the human-readable configured currency without changing the stored base currency. */
function currencyLabel(code: string) {
  return CURRENCY_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

/** Resolves the human-readable configured timezone without changing the stored timezone. */
function timezoneLabel(timezone: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

/** Keeps global Settings as a selector and routes all business-specific settings into the Business hierarchy. */
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <PageHeading
        title="الإعدادات"
        description="اختر البزنس الذي تريد مراجعة إعداداته. كل الإعدادات الخاصة بالبزنس تُدار من داخل مساحة عمله."
      />

      {params.status === "business-deleted" && (
        <div className={settingsStyles.success} role="status">
          تم حذف البزنس بنجاح.
        </div>
      )}

      {error ? (
        <section className={styles.errorPanel} role="alert">
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="اختيار بزنس للإعدادات">
          {businesses.map((business) => (
            <article
              className={styles.businessCard}
              key={business.id}
              aria-label={`إعدادات بزنس ${business.name}`}
            >
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
                <p>افتح إعدادات هذا البزنس لمراجعة هويته والوصول إلى الإجراءات الخاصة به.</p>
                <Link
                  className={styles.primaryAction}
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
      ) : (
        <section className={styles.emptyState}>
          <div>
            <span className={styles.kicker}>لا توجد إعدادات بعد</span>
            <h2>أضف بزنسًا أولًا</h2>
            <p>إعدادات العملة والمنطقة الزمنية ترتبط بكل بزنس بصورة مستقلة.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
