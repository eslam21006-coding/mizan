import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { currentMonthKeyForTimeZone, shiftMonthKey } from "@/lib/business/monthly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";

export default async function MonthlyOverviewPage() {
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <PageHeading
        title="الأرقام الشهرية"
        description="اختر البزنس ثم افتح الشهر الذي تريد إدخال أرقامه أو مراجعته. كل شهر محفوظ يظل لقطة تاريخية مستقلة."
      />

      {error ? (
        <section className={styles.errorPanel}>
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="بزنسات الإدخال الشهري">
          {businesses.map((business) => {
            const currentMonth = currentMonthKeyForTimeZone(business.timezone);
            const previousMonth = shiftMonthKey(currentMonth, -1);
            return (
              <article className={styles.businessCard} key={business.id}>
                <div className={styles.cardTopline}>
                  <span className={styles.status}>إدخال ومراجعة شهري</span>
                  <span className={styles.currencyCode}>{business.base_currency}</span>
                </div>
                <h2>{business.name}</h2>
                <div className={styles.nextStep}>
                  <p>
                    ابدأ بالشهر الحالي، أو افتح الشهر السابق، ثم استخدم اختيار الشهر داخل صفحة الإدخال
                    للوصول لأي شهر تاريخي آخر.
                  </p>
                  <div className={styles.manageLinks}>
                    <Link
                      className={styles.manageLink}
                      href={`/businesses/${business.id}/monthly?month=${currentMonth}`}
                    >
                      الشهر الحالي
                    </Link>
                    {previousMonth && (
                      <Link
                        className={styles.manageLink}
                        href={`/businesses/${business.id}/monthly?month=${previousMonth}`}
                      >
                        الشهر السابق
                      </Link>
                    )}
                    <Link
                      className={styles.manageLink}
                      href={`/?business=${business.id}&month=${currentMonth}`}
                    >
                      فتح الداشبورد
                    </Link>
                    <Link
                      className={styles.manageLink}
                      href={`/analytics?business=${business.id}&month=${currentMonth}`}
                    >
                      التحليلات
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <div>
            <span className={styles.kicker}>ابدأ من البزنس</span>
            <h2>لا يوجد بزنس لإدخال أرقامه بعد</h2>
            <p>أنشئ البزنس أولًا، ثم عرّف مصادر الإيراد والمصروفات قبل إدخال الأرقام الشهرية.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
