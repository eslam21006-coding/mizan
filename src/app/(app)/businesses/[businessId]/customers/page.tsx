import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerCohortLtvTable } from "./customer-cohort-ltv-table";
import { CustomerGroupsTable } from "./customer-groups-table";
import styles from "./customer-groups.module.css";
import { LifetimeContributionTable } from "./lifetime-contribution-table";
import { LifetimeRevenueStreamTable } from "./lifetime-revenue-stream-table";

type BusinessCustomersPageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessCustomersPage({ params }: BusinessCustomersPageProps) {
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
      <div className={styles.pageHeadingRow}>
        <PageHeading
          title={`عملاء ${business.name}`}
          description="راجع العملاء، كوهورتات الاكتساب، قيمة العميل المحققة، مصادر الإيراد، وربح المساهمة مدى الحياة من سجل المعاملات الفعلي."
        />
        <div className={styles.pageActions}>
          <Link className={styles.actionLink} href={`/businesses/${business.id}/customers/import`}>
            استيراد معاملات
          </Link>
          <Link className={styles.actionLink} href={`/businesses/${business.id}/customers/revenue-stream-attribution`}>
            ربط مصادر الإيراد
          </Link>
          <Link className={styles.actionLink} href={`/businesses/${business.id}/customers/lifetime-contribution`}>
            تكاليف المساهمة
          </Link>
          <Link className={styles.actionLink} href="/customers">
            كل البزنسات
          </Link>
        </div>
      </div>

      <section className={styles.businessStrip} aria-label="سياق البزنس">
        <div>
          <span>البزنس</span>
          <strong>{business.name}</strong>
        </div>
        <div>
          <span>العملة الأساسية</span>
          <strong dir="ltr">{business.base_currency}</strong>
        </div>
        <div>
          <span>منطقة التقارير</span>
          <strong dir="ltr">{business.timezone}</strong>
        </div>
      </section>

      <CustomerCohortLtvTable businessId={business.id} baseCurrency={business.base_currency} />
      <LifetimeRevenueStreamTable businessId={business.id} baseCurrency={business.base_currency} />
      <LifetimeContributionTable businessId={business.id} baseCurrency={business.base_currency} />

      <CustomerGroupsTable
        businessId={business.id}
        baseCurrency={business.base_currency}
        timezone={business.timezone}
      />
    </div>
  );
}
