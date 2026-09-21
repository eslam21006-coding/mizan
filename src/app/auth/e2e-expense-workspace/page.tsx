import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExpensesWorkspaceHeader } from "@/app/(app)/businesses/[businessId]/expenses/expenses-workspace-header";

export const dynamic = "force-dynamic";

const businessId = "123e4567-e89b-42d3-a456-426614174000";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for N39 Expense Structure workspace hierarchy and primary action. */
export default function ExpenseWorkspaceFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار هيكل المصروفات داخل مساحة البزنس">
        <ExpensesWorkspaceHeader
          businessId={businessId}
          businessName="أكاديمية ميزان"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          canManage
          returnOrigin={null}
          creationRequestId="22222222-2222-4222-8222-222222222222"
        />

        <section className="shell-card" aria-label="المصروفات الحالية">
          <strong>إعلانات Meta</strong>
          <p>اكتساب العملاء · ثابت شهريًا</p>
        </section>
      </section>
    </AppShell>
  );
}
