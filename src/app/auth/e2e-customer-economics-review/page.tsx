import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CustomerEconomicsReviewPanel } from "@/app/(app)/businesses/[businessId]/customers/review/customer-economics-review-panel";
import { CustomerReviewNavigation } from "@/app/(app)/businesses/[businessId]/customers/review/customer-review-navigation";
import { HistoricalCorrectionForm } from "@/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-form";
import type {
  ExpenseInputRow,
  RevenueInputRow,
} from "@/app/(app)/businesses/[businessId]/monthly/monthly-entry-form";
import { AppShell } from "@/components/app-shell";
import { InPageErrorState, ReturnContextBanner } from "@/components/workflow-recovery";
import { parseReturnOrigin } from "@/lib/return-origin";

const DEFAULT_BUSINESS_ID = "99999999-9999-4999-8999-999999999999";
const JOURNEY_BUSINESS_ID = "00000000-0000-4000-8000-000000000025";
const FIXTURE_PATH = "/auth/e2e-customer-economics-review";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.task5@example.test",
};

type CustomerEconomicsReviewFixturePageProps = {
  searchParams: Promise<{ state?: string; origin?: string | string[]; month?: string | string[]; businessId?: string | string[] }>;
};

const revenueRows: RevenueInputRow[] = [
  {
    id: "99999999-9999-4999-8999-999999999901",
    name: "Core Offer",
    streamType: "front_end",
    active: true,
    gross: "20000",
    refunds: "500",
  },
];

const expenseRows: ExpenseInputRow[] = [
  {
    id: "99999999-9999-4999-8999-999999999902",
    name: "Meta Ads",
    category: "acquisition",
    behavior: "fixed_monthly",
    active: true,
    value: "4500",
    basis: "",
  },
];

/** Renders isolated Customer Review success and recoverable-error states for browser verification. */
export default async function CustomerEconomicsReviewFixturePage({
  searchParams,
}: CustomerEconomicsReviewFixturePageProps) {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  const query = await searchParams;
  const journeyBusinessSelected = query.businessId === JOURNEY_BUSINESS_ID;
  const businessId = journeyBusinessSelected ? JOURNEY_BUSINESS_ID : DEFAULT_BUSINESS_ID;
  const parsedOrigin = parseReturnOrigin({ origin: query.origin, month: query.month });
  const returnOrigin = parsedOrigin?.origin === "customer-profitability" ? parsedOrigin : null;
  const returnBanner = returnOrigin ? (
    <ReturnContextBanner
      purpose="بيانات مطلوبة في ربحية العميل"
      origin={returnOrigin}
      context={{ businessId }}
      returnLabel="العودة إلى ربحية العميل"
      ariaLabel="العودة إلى ربحية العميل"
    />
  ) : null;

  if (query.state === "error") {
    const retryHref = (() => {
      if (!returnOrigin && !journeyBusinessSelected) return FIXTURE_PATH;
      const retryParams = new URLSearchParams();
      if (returnOrigin) {
        retryParams.set("origin", returnOrigin.origin);
        if (returnOrigin.month) retryParams.set("month", returnOrigin.month);
      }
      if (journeyBusinessSelected) retryParams.set("businessId", businessId);
      return `${FIXTURE_PATH}?${retryParams.toString()}`;
    })();
    return (
      <AppShell {...fixtureShellProps}>
        <div className="page-stack">
          <CustomerReviewNavigation businessId={businessId} businessName="بزنس مراجعة الاختبار" />
          {returnBanner}
          <InPageErrorState
            title="تعذر تحميل بيانات المراجعة"
            description="تعذر تحميل بيانات المراجعة كاملة. لم يتم عرض حالة نظيفة حتى لا نخفي ملاحظة محتملة."
            retryAction={<Link href={retryHref}>إعادة المحاولة</Link>}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <CustomerReviewNavigation businessId={businessId} businessName="بزنس مراجعة الاختبار" />
        {returnBanner}
        <CustomerEconomicsReviewPanel
          businessId={businessId}
          baseCurrency="EGP"
          canManage
          statusMessage="تم تحميل مثال المراجعة بنجاح."
          returnOrigin={returnOrigin}
          exceptions={[
            {
              activity_month: "2026-03-01",
              exception_code: "NO_NEW_CUSTOMERS",
              authoritative_source_id: "99999999-9999-4999-8999-999999999903",
              expense_name_snapshot: "Meta Ads",
              amount: "4500",
              currency: "EGP",
              can_manual_override: true,
              blocking: true,
            },
            {
              activity_month: "2026-04-01",
              exception_code: "REVENUE_COVERAGE_MISMATCH",
              authoritative_source_id: null,
              expense_name_snapshot: null,
              amount: "250",
              currency: "EGP",
              can_manual_override: false,
              blocking: true,
            },
            {
              activity_month: "2026-05-01",
              exception_code: "BUSINESS_NET_CASH_MISSING",
              authoritative_source_id: null,
              expense_name_snapshot: null,
              amount: null,
              currency: "EGP",
              can_manual_override: false,
              blocking: true,
            },
          ]}
          trustedMonths={[
            { cohortMonth: "2026-01-01" },
            { cohortMonth: "2026-02-01" },
          ]}
          legacyAllocations={[
            {
              id: "99999999-9999-4999-8999-999999999904",
              cohort_month: "2026-01-01",
              cost_type: "acquisition",
              amount: "3000",
              note: "توزيع يناير القديم",
            },
            {
              id: "99999999-9999-4999-8999-999999999905",
              cohort_month: "2026-02-01",
              cost_type: "acquisition",
              amount: "2000",
              note: "توزيع فبراير القديم",
            },
          ]}
          eligibleCostPools={[
            {
              authoritative_source_id: "99999999-9999-4999-8999-999999999906",
              activity_month: "2026-04-01",
              expense_name_snapshot: "Legacy Acquisition Pool",
              category_snapshot: "acquisition",
              authoritative_amount: "5000",
              currency: "EGP",
            },
          ]}
        />

        <section>
          <span className="eyebrow">اختبار التصحيح التاريخي</span>
          <h1>تصحيح شهر سابق</h1>
        </section>
        <HistoricalCorrectionForm
          businessId={businessId}
          monthKey="2026-08"
          monthLabel="أغسطس ٢٠٢٦"
          currency="EGP"
          revenueRows={revenueRows}
          expenseRows={expenseRows}
          period={{
            new_customers: 20,
            total_paying_customers: 25,
            unallocated_gross_cash_collected: 0,
            unallocated_refunds: 0,
            adjustment_note: "بيانات الشهر قبل التصحيح",
          }}
          canEdit
          payingCustomersDerived={false}
          newCustomersDerived={false}
          payingCustomersCount={null}
        />
      </div>
    </AppShell>
  );
}
