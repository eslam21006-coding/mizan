import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BusinessWorkspaceShell } from "./business-workspace-shell";
import styles from "./workspace-page.module.css";

type BusinessOverviewPageProps = {
  params: Promise<{ businessId: string }>;
};

/** Loads the selected business and renders the Overview tab inside the shared workspace shell. */
export default async function BusinessOverviewPage({ params }: BusinessOverviewPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency,timezone")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) notFound();

  return (
    <div className="page-stack">
      <BusinessWorkspaceShell
        businessId={businessId}
        businessName={business.name}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
        activeTab="overview"
      />

      <PageHeading
        title="نظرة عامة"
        description={`مساحة العمل الخاصة بـ ${business.name} لإدارة هيكل البزنس من مكان واحد.`}
      />

      <section className={styles.panel}>
        <strong>مساحة البزنس</strong>
        <p>
          استخدم التبويبات لمراجعة مصادر الإيراد وهيكل المصروفات وإعدادات البزنس مع الحفاظ على نفس
          سياق البزنس.
        </p>
      </section>
    </div>
  );
}
