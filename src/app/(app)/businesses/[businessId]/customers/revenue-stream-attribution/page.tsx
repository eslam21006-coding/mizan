import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../lifetime-economics.module.css";
import { RevenueStreamAttributionManager } from "./revenue-stream-attribution-manager";

type Props = { params: Promise<{ businessId: string }> };

export default async function RevenueStreamAttributionPage({ params }: Props) {
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

  const canManage = auth.role === "admin" || auth.userId === business.owner_user_id;

  return (
    <div className="page-stack">
      <div className={styles.headingRow}>
        <PageHeading
          title="ربط المعاملات بمصادر الإيراد"
          description={`حدد مصدر الإيراد الحقيقي لكل معاملة في ${business.name}. لا يتم أي تخمين تلقائي.`}
        />
        <Link className={styles.backLink} href={`/businesses/${business.id}/customers`}>
          العودة إلى العملاء و LTV
        </Link>
      </div>
      <RevenueStreamAttributionManager
        businessId={business.id}
        baseCurrency={business.base_currency}
        canManage={canManage}
      />
    </div>
  );
}
