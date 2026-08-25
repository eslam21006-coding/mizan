import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./transaction-import.module.css";
import { TransactionPreviewUploader } from "./transaction-preview-uploader";

type TransactionImportPageProps = {
  params: Promise<{ businessId: string }>;
};

const IMPORT_THEME_ALIASES = {
  "--text-primary": "var(--text)",
  "--text-secondary": "var(--text-soft)",
  "--surface-primary": "var(--surface)",
  "--surface-secondary": "var(--surface-soft)",
  "--border-subtle": "var(--border)",
  "--accent-primary": "var(--brand)",
} as CSSProperties;

export default async function TransactionImportPage({ params }: TransactionImportPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  return (
    <div className="page-stack" style={IMPORT_THEME_ALIASES}>
      <div className={styles.headingRow}>
        <PageHeading
          title="استيراد معاملات العملاء"
          description="ارفع ملف CSV أو XLSX من بوابة الدفع، ثم راجع البيانات قبل حفظها في ميزان."
        />
        <div className={styles.headingLinks}>
          <a
            className={`${styles.backLink} ${styles.templateLink}`}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل نموذج CSV
          </a>
          <Link className={styles.backLink} href="/customers">
            العملاء و LTV
          </Link>
          <Link className={styles.backLink} href={`/?business=${business.id}`}>
            الداشبورد
          </Link>
        </div>
      </div>

      <section className={styles.importGuide} aria-labelledby="import-guide-title">
        <div className={styles.guideHeading}>
          <div>
            <span className={styles.kicker}>قبل رفع الملف</span>
            <h2 id="import-guide-title">ماذا يجب أن يحتوي الملف؟</h2>
          </div>
          <a
            className={styles.guideDownload}
            href="/mizan-transactions-template.csv"
            download="mizan-transactions-template.csv"
          >
            تنزيل النموذج الجاهز
          </a>
        </div>

        <div className={styles.guideGrid}>
          <article className={styles.guideCard}>
            <span className={styles.requiredBadge}>مطلوب</span>
            <ul>
              <li>
                <strong>البريد الإلكتروني للعميل</strong>
                <small dir="ltr">Customer Email</small>
              </li>
              <li>
                <strong>تاريخ المعاملة</strong>
                <small dir="ltr">Transaction Date</small>
                <small dir="ltr">مثال: 2026-08-23 أو 2026-08-23T14:30:00+03:00</small>
              </li>
              <li>
                <strong>المبلغ المحصل</strong>
                <small dir="ltr">Amount Collected</small>
              </li>
            </ul>
          </article>

          <article className={styles.guideCard}>
            <span className={styles.optionalBadge}>اختياري</span>
            <ul>
              <li>
                <strong>رقم المعاملة</strong>
                <small dir="ltr">Transaction ID</small>
                <small>يفضل وجوده لأنه يجعل اكتشاف التكرار أكثر دقة.</small>
              </li>
              <li>
                <strong>العملة</strong>
                <small dir="ltr">Currency</small>
                <small>إذا لم توجد في الملف، ستؤكد أن جميع المعاملات بعملة البزنس.</small>
              </li>
            </ul>
          </article>
        </div>

        <p className={styles.guideNote}>
          يمكن أن تكون أسماء أعمدة ملفك مختلفة؛ بعد رفع الملف ستحدد لميزان أي عمود يمثل كل معلومة.
        </p>
        <p className={styles.splitNote}>
          يجب أن يحتوي الملف الواحد على تحصيلات أو استرجاعات فقط. إذا كان التصدير يحتوي على النوعين، افصلهما إلى ملفين ثم ارفع كل ملف على حدة.
        </p>
      </section>

      <section className={styles.businessContext} aria-label="البزنس المحدد">
        <div>
          <span>البزنس</span>
          <strong>{business.name}</strong>
        </div>
        <div>
          <span>العملة الأساسية</span>
          <strong dir="ltr">{business.base_currency}</strong>
        </div>
        <div>
          <span>المنطقة الزمنية</span>
          <strong dir="ltr">{business.timezone}</strong>
        </div>
        <p className={styles.businessContextNote}>
          لن تُحفظ أي معاملة قبل مراجعة الملف وتأكيد الاستيراد.
        </p>
      </section>

      <TransactionPreviewUploader
        businessId={business.id}
        baseCurrency={business.base_currency}
        canManage={canManage}
      />
    </div>
  );
}
