import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { parseResourceId } from "@/lib/business/revenue-streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CustomerEconomicsReviewPanel,
  type EligibleCostPool,
  type LegacyAllocation,
  type ReviewException,
} from "./customer-economics-review-panel";

type ReviewPageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const STATUS_MESSAGES: Record<string, string> = {
  "override-saved": "تم حفظ التوزيع الاستثنائي وإعادة حساب اقتصاديات العميل.",
  "legacy-reconciled": "تم ربط السجلات القديمة بالمصروف الفعلي وحفظ أثر المراجعة.",
  "invalid-input": "راجع المدخلات. يجب أن تكون المبالغ موجبة، والسبب مطلوب، ومجموع التوزيع يجب أن يطابق التكلفة الفعلية بالضبط.",
  "override-failed": "تعذر حفظ التوزيع. قد يكون المجموع غير مطابق، أو شهر أول الشراء غير موثوق، أو الملاحظة لم تعد صالحة للتوزيع اليدوي.",
  "legacy-failed": "تعذر ربط السجلات القديمة. تأكد أنها من نفس نوع التكلفة وأن مجموعها يساوي المصروف الفعلي المختار بالضبط.",
};

/** Loads the authorized founder review queue and the evidence needed for exception-only resolution. */
export default async function CustomerEconomicsReviewPage({ params, searchParams }: ReviewPageProps) {
  const { businessId: rawBusinessId } = await params;
  const businessId = parseResourceId(rawBusinessId);
  if (!businessId) notFound();

  const auth = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const [
    businessResult,
    exceptionsResult,
    trustedMonthsResult,
    legacyResult,
    legacyReconciliationsResult,
    poolsResult,
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id,name,base_currency,owner_user_id")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("customer_economics_review_exceptions")
      .select(
        "activity_month,exception_code,authoritative_source_id,expense_name_snapshot,amount,currency,can_manual_override,blocking",
      )
      .eq("business_id", businessId)
      .order("activity_month", { ascending: false, nullsFirst: true }),
    supabase
      .from("customer_economics_activity_evidence")
      .select("cohort_month")
      .eq("business_id", businessId)
      .eq("allocation_driver", "new_customers")
      .order("cohort_month", { ascending: true }),
    supabase
      .from("customer_economics_legacy_manual_allocations")
      .select("id,cohort_month,cost_type,amount,note")
      .eq("business_id", businessId)
      .order("cohort_month", { ascending: true }),
    supabase
      .from("customer_economics_legacy_reconciliations")
      .select("legacy_allocation_id")
      .eq("business_id", businessId),
    supabase
      .from("customer_economics_cost_pool_plan")
      .select(
        "authoritative_source_id,activity_month,expense_name_snapshot,category_snapshot,authoritative_amount,currency",
      )
      .eq("business_id", businessId)
      .eq("cost_eligibility", "eligible")
      .eq("transaction_history_complete", true)
      .gt("authoritative_amount", 0)
      .order("activity_month", { ascending: false }),
  ]);

  const business = businessResult.data;
  if (businessResult.error || !business) notFound();

  const dataLoadError = Boolean(
    exceptionsResult.error ||
      trustedMonthsResult.error ||
      legacyResult.error ||
      legacyReconciliationsResult.error ||
      poolsResult.error,
  );

  if (dataLoadError) {
    return (
      <div className="page-stack">
        <div>
          <span className="eyebrow">Customer Economics</span>
          <h1>ملاحظات تحتاج مراجعتك</h1>
          <p className="muted-copy">تعذر تحميل بيانات المراجعة كاملة. لم يتم عرض حالة نظيفة حتى لا نخفي ملاحظة محتملة.</p>
        </div>
        <Link href={`/businesses/${businessId}/customers`}>العودة لاقتصاديات العميل</Link>
      </div>
    );
  }

  const trustedMonths = (trustedMonthsResult.data ?? [])
    .filter((row) => row.cohort_month)
    .map((row) => ({ cohortMonth: String(row.cohort_month) }));

  const reconciledLegacyIds = new Set(
    (legacyReconciliationsResult.data ?? []).map((row) => String(row.legacy_allocation_id)),
  );
  const legacyAllocations = (legacyResult.data ?? [])
    .filter((row) => !reconciledLegacyIds.has(String(row.id)))
    .map((row) => ({
      id: String(row.id),
      cohort_month: String(row.cohort_month),
      cost_type: String(row.cost_type),
      amount: row.amount as string | number,
      note: row.note === null ? null : String(row.note),
    })) as LegacyAllocation[];

  const eligibleCostPools = (poolsResult.data ?? []).map((row) => ({
    authoritative_source_id: String(row.authoritative_source_id),
    activity_month: String(row.activity_month),
    expense_name_snapshot: String(row.expense_name_snapshot),
    category_snapshot: String(row.category_snapshot),
    authoritative_amount: row.authoritative_amount as string | number,
    currency: row.currency === null ? null : String(row.currency),
  })) as EligibleCostPool[];

  const query = await searchParams;
  const statusMessage = query.status ? STATUS_MESSAGES[query.status] ?? null : null;
  const statusIsError = Boolean(
    query.status && !["override-saved", "legacy-reconciled"].includes(query.status),
  );
  const canManage = auth.role === "admin" || business.owner_user_id === auth.userId;

  return (
    <CustomerEconomicsReviewPanel
      businessId={business.id}
      baseCurrency={business.base_currency}
      canManage={canManage}
      exceptions={(exceptionsResult.data ?? []) as ReviewException[]}
      trustedMonths={trustedMonths}
      legacyAllocations={legacyAllocations}
      eligibleCostPools={eligibleCostPools}
      statusMessage={statusMessage}
      statusIsError={statusIsError}
    />
  );
}
