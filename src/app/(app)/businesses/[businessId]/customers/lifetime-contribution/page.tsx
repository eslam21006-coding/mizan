import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LifetimeContributionTable } from "../lifetime-contribution-table";
import styles from "../lifetime-economics.module.css";

type Props = { params: Promise<{ businessId: string }> };

/** Shows automatic customer profitability without exposing legacy manual cohort-allocation controls. */
export default async function LifetimeContributionPage({ params }: Props) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id,name,base_currency")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !business) notFound();

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="ربحية العملاء"
          description="ميزان يحسب ربحية العميل تلقائيًا من سجل المعاملات والمصروفات الشهرية. لا تحتاج إلى توزيع تكلفة الاكتساب أو تكاليف العميل يدويًا على كل شهر أول شراء. افتح طريقة الحساب لكل صف لمراجعة التفاصيل والحالة."
        />
        <Link className={styles.backLink} href={`/businesses/${business.id}/customers`}>
          العودة إلى العملاء وقيمة العميل
        </Link>
      </div>
      <LifetimeContributionTable businessId={business.id} baseCurrency={business.base_currency} />
    </div>
  );
}
