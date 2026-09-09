import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../lifetime-economics.module.css";
import { LifetimeContributionAllocationManager } from "./lifetime-contribution-allocation-manager";

type Props = { params: Promise<{ businessId: string }> };

export default async function LifetimeContributionPage({ params }: Props) {
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
          title="التكاليف المرتبطة بربحية العملاء"
          description="راجع فقط تكلفة اكتساب هؤلاء العملاء، والتكاليف التي تتغير فعلًا مع العميل، ورسوم بوابة الدفع القابلة للتخصيص. الرواتب الشهرية الثابتة والإيجار والإدارة وأي Fixed Monthly لا تدخل هنا؛ مكانها في Real Net Profit."
        />
        <Link className={styles.backLink} href={`/businesses/${business.id}/customers`}>
          العودة إلى العملاء وقيمة العميل
        </Link>
      </div>
      <LifetimeContributionAllocationManager
        businessId={business.id}
        baseCurrency={business.base_currency}
        canManage={canManage}
      />
    </div>
  );
}
