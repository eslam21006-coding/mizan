import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../businesses/businesses.module.css";
import { SettingsBusinessSelector } from "./settings-business-selector";
import settingsStyles from "./settings.module.css";

type SettingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

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
        <SettingsBusinessSelector
          businesses={businesses.map((business) => ({
            id: business.id,
            name: business.name,
            baseCurrency: business.base_currency,
            timezone: business.timezone,
          }))}
        />
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
