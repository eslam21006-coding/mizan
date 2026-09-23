import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { resolveAdminViewingMenteeUserId } from "@/lib/admin-business-viewing";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessWorkspaceShell } from "../business-workspace-shell";
import styles from "../workspace-page.module.css";

type BusinessSettingsPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads the selected business and renders its read-only identity inside the Settings workspace tab. */
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

  const adminViewingMenteeUserId = resolveAdminViewingMenteeUserId(
    auth.role,
    auth.userId,
    business.owner_user_id,
  );

  return (
    <div className="page-stack">
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        activeTab="settings"
        adminViewingMenteeUserId={adminViewingMenteeUserId}
      />

      <PageHeading
        title="الإعدادات"
        description={`راجع بيانات ${business.name} الأساسية داخل نفس مساحة العمل.`}
      />

      <section className={styles.panel}>
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
    </div>
  );
}
