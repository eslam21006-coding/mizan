import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CustomerEconomicsReviewPanel } from "@/app/(app)/businesses/[businessId]/customers/review/customer-economics-review-panel";
import { HistoricalCorrectionForm } from "@/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-form";
import type {
  ExpenseInputRow,
  RevenueInputRow,
} from "@/app/(app)/businesses/[businessId]/monthly/monthly-entry-form";
import { AppShell } from "@/components/app-shell";

const BUSINESS_ID = "99999999-9999-4999-8999-999999999999";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.task5@example.test",
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

export default async function CustomerEconomicsReviewFixturePage() {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <CustomerEconomicsReviewPanel
          businessId={BUSINESS_ID}
          baseCurrency="EGP"
          canManage
          statusMessage="تم تحميل مثال المراجعة بنجاح."
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
          businessId={BUSINESS_ID}
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
