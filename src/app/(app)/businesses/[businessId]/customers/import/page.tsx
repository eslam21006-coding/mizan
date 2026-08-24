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
    .select("id,name,base_currency,owner_user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  return (
    <div className="page-stack" style={IMPORT_THEME_ALIASES}>
      <div className={styles.headingRow}>
        <PageHeading
          title="استيراد معاملات العملاء"
          description={`اختر تصدير CSV أو XLSX خاص بـ ${business.name}، راجع الـ Mapping والـ Validation، ثم استورد المعاملات مع منع التكرار.`}
        />
        <div className={styles.headingLinks}>
          <Link className={styles.backLink} href="/customers">
            العملاء و LTV
          </Link>
          <Link className={styles.backLink} href={`/?business=${business.id}`}>
            الداشبورد
          </Link>
        </div>
      </div>

      <section className={styles.businessContext} aria-label="البزنس المحدد">
        <div>
          <span>البزنس</span>
          <strong>{business.name}</strong>
        </div>
        <div>
          <span>العملة الأساسية</span>
          <strong dir="ltr">{business.base_currency}</strong>
        </div>
        <p>
          المعاينة والـ Mapping والـ Validation تظل داخل المتصفح. لا تُحفظ المعاملات إلا بعد نجاح Validation
          وضغطك على زر الاستيراد، وعندها يطبق Mizan Duplicate Protection داخل قاعدة البيانات.
        </p>
      </section>

      <TransactionPreviewUploader businessId={business.id} canManage={canManage} />
    </div>
  );
}
