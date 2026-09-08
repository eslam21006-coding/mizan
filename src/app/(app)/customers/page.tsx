import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";

/** Lists accessible businesses and routes users to automatic customer-history analysis or import. */
export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency")
    .order("created_at", { ascending: false });

  return (
    <div className="page-stack">
      <PageHeading
        title="العملاء وقيمة العميل"
        description="استورد معاملات العملاء، ثم افتح التحليل لمعرفة سجل كل عميل، من اشترى أكثر من مرة، ومتوسط ما دفعه العملاء منذ أول شراء. Observed LTV / قيمة العميل المحققة حتى الآن تأتي من سجل المعاملات الفعلي، وتجميع معاملات العميل يتم تلقائيًا داخل ميزان."
      />

      {error ? (
        <section className={styles.errorPanel}>
          <strong>تعذر تحميل البزنسات</strong>
          <p>لم يتم تغيير أو رفع أي بيانات. أعد تحميل الصفحة وحاول مرة أخرى.</p>
        </section>
      ) : businesses && businesses.length > 0 ? (
        <section className={styles.grid} aria-label="بزنسات معاملات العملاء">
          {businesses.map((business) => (
            <article className={styles.businessCard} key={business.id}>
              <div className={styles.cardTopline}>
                <span className={styles.status}>معاملات العملاء</span>
                <span className={styles.currencyCode}>{business.base_currency}</span>
              </div>
              <h2>{business.name}</h2>
              <div className={styles.nextStep}>
                <p>
                  افتح تحليل العملاء لمراجعة سجل كل عميل وقيمة العملاء حسب شهر أول شراء وObserved LTV المحقق حتى الآن. لا توجد خطوة تجميع يدوية؛ ميزان يجمع معاملات العميل تلقائيًا.
                </p>
                <div className={styles.manageLinks}>
                  <Link className={styles.manageLink} href={`/businesses/${business.id}/customers`}>
                    عرض تحليل العملاء
                  </Link>
                  <Link
                    className={styles.manageLink}
                    href={`/businesses/${business.id}/customers/import`}
                  >
                    استيراد CSV / XLSX
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
            <p>ملفات معاملات العملاء يجب أن ترتبط ببزنس محدد حتى تظل العملة والبيانات منفصلة.</p>
            <Link className={styles.addButton} href="/businesses/new">
              إعداد أول بزنس
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
