import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";

export default async function FunnelsOverviewPage() {
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <PageHeading
        title="الفانلز"
        description="الفانلز طبقة تحليل اختيارية. اختر البزنس الذي تريد إدارة فانلزُه مع بقاء اقتصاديات البزنس هي المرجع الأساسي."
      />

      {error ? (
        <section className={styles.errorPanel}>
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم تغيير أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="بزنسات إدارة الفانلز">
          {businesses.map((business) => (
            <article className={styles.businessCard} key={business.id}>
              <div className={styles.cardTopline}>
                <span className={styles.status}>فانلز اختيارية</span>
                <span className={styles.currencyCode}>{business.base_currency}</span>
              </div>
              <h2>{business.name}</h2>
              <div className={styles.nextStep}>
                <p>أنشئ أو عدّل أو عطّل فانلز هذا البزنس بدون تغيير أرقامه المالية الأساسية.</p>
                <div className={styles.manageLinks}>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/funnels`}>
                    إدارة الفانلز
                  </Link>
                  <Link className={styles.manageLink} href={`/?business=${business.id}`}>
                    فتح الداشبورد
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <div>
            <span className={styles.kicker}>لا يوجد بزنس بعد</span>
            <h2>أضف بزنسًا أولًا</h2>
            <p>الفانلز تتبع بزنسًا محددًا، لكنها تظل اختيارية بعد إنشاء البزنس.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
