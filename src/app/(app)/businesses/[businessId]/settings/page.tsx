import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { resolveNavigationDestination } from "@/lib/navigation-hierarchy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessWorkspaceShell } from "../business-workspace-shell";
import styles from "../workspace-page.module.css";
import settingsStyles from "./business-settings.module.css";

type BusinessSettingsPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads the authoritative settings view for one selected business inside its workspace hierarchy. */
export default async function BusinessSettingsPage({ params }: BusinessSettingsPageProps) {
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

  const canDelete = auth.role === "admin" || business.owner_user_id === auth.userId;

  return (
    <div className="page-stack">
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        activeTab="settings"
      />

      <PageHeading
        title="إعدادات البزنس"
        description={`راجع بيانات ${business.name} الأساسية والإجراءات الخاصة بهذا البزنس من داخل مساحة عمله.`}
      />

      <section className={styles.panel} aria-labelledby="business-identity-heading">
        <strong id="business-identity-heading">هوية البزنس</strong>
        <dl className={styles.settingsList}>
          <div>
            <dt>اسم البزنس</dt>
            <dd>{business.name}</dd>
          </div>
          <div>
            <dt>العملة الأساسية</dt>
            <dd dir="ltr">{business.base_currency}</dd>
          </div>
          <div>
            <dt>المنطقة الزمنية</dt>
            <dd dir="ltr">{business.timezone}</dd>
          </div>
        </dl>
      </section>

      {canDelete && (
        <section className={settingsStyles.dangerZone} aria-labelledby="business-danger-heading">
          <div>
            <strong id="business-danger-heading">منطقة خطرة</strong>
            <p>حذف البزنس إجراء دائم ويتطلب تأكيدًا يدويًا في خطوة منفصلة.</p>
          </div>
          <Link
            className={settingsStyles.deleteLink}
            href={resolveNavigationDestination({ route: "business-delete", businessId })}
          >
            حذف البزنس
          </Link>
        </section>
      )}
    </div>
  );
}
