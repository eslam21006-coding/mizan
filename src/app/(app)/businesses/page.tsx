import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/business/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./businesses.module.css";

type BusinessesPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function getCurrencyLabel(code: string) {
  return CURRENCY_OPTIONS.find((option) => option.code === code)?.label ?? code;
}

function getTimezoneLabel(timezone: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ?? timezone;
}

export default async function BusinessesPage({ searchParams }: BusinessesPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="البزنس"
          description="أضف البزنسات التي تريد متابعتها في ميزان. كل بزنس له عملة أساسية ومنطقة زمنية مستقلة."
        />
        <Link className={styles.addButton} href="/businesses/new">
          إضافة بزنس
        </Link>
      </div>

      {params.status === "created" && (
        <div className={styles.success} role="status">
          تم إنشاء البزنس وربطه بحسابك بنجاح.
        </div>
      )}

      {error ? (
        <section className={styles.errorPanel}>
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="البزنسات المتاحة">
          {businesses.map((business) => (
            <article className={styles.businessCard} key={business.id}>
              <div className={styles.cardTopline}>
                <span className={styles.status}>جاهز للإعداد</span>
                <span className={styles.currencyCode}>{business.base_currency}</span>
              </div>
              <h2>{business.name}</h2>
              <dl className={styles.metaList}>
                <div>
                  <dt>العملة الأساسية</dt>
                  <dd>
                    {business.base_currency} — {getCurrencyLabel(business.base_currency)}
                  </dd>
                </div>
                <div>
                  <dt>المنطقة الزمنية</dt>
                  <dd>{getTimezoneLabel(business.timezone)}</dd>
                </div>
              </dl>
              <div className={styles.nextStep}>
                <p>جهّز مصادر الإيراد والمصروفات، ثم أدخل الأرقام الفعلية لكل شهر.</p>
                <div className={styles.manageLinks}>
                  <Link
                    className={styles.manageLink}
                    href={`/businesses/${business.id}/revenue-streams`}
                  >
                    إدارة مصادر الإيراد
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/expenses`}>
                    إدارة المصروفات
                  </Link>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/monthly`}>
                    الإدخال الشهري
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <span className={styles.kicker}>ابدأ من هنا</span>
            <h2>لا يوجد بزنس مضاف بعد</h2>
            <p>أضف الاسم والعملة والمنطقة الزمنية. لن نطلب منك أي أرقام مالية في هذه الخطوة.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
