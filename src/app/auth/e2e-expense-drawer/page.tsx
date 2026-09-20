import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COST_BEHAVIOR_OPTIONS,
} from "@/lib/business/expenses";
import type { SetupReturnOrigin } from "@/lib/setup-return-origin";
import { ExpenseDrawerLauncher } from "@/app/(app)/businesses/[businessId]/expenses/expense-drawer";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const returnOrigin: SetupReturnOrigin = {
  origin: "monthly-editor",
  month: "2026-09",
  upstream: {
    origin: "customer-profitability",
    month: "2026-07",
  },
};

/** CI-only fixture for the N28/N29 Expense drawer without database dependencies. */
export default function ExpenseDrawerFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <AppShell {...fixtureShellProps}>
      <main className="page-stack" aria-label="اختبار درج المصروفات">
        <section className="panel">
          <h1>إدارة المصروفات</h1>
          <p className="muted-copy">واجهة اختبار معزولة لسلوك الإضافة والتعديل داخل الدرج.</p>
          <ExpenseDrawerLauncher
            businessId="123e4567-e89b-42d3-a456-426614174000"
            returnOrigin={returnOrigin}
            categoryOptions={EXPENSE_CATEGORY_OPTIONS}
            behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
            mode="create"
            creationRequestId="123e4567-e89b-42d3-a456-426614174001"
          />
        </section>

        <section className="panel">
          <h2>إعلانات Meta</h2>
          <ExpenseDrawerLauncher
            businessId="123e4567-e89b-42d3-a456-426614174000"
            returnOrigin={returnOrigin}
            categoryOptions={EXPENSE_CATEGORY_OPTIONS}
            behaviorOptions={EXPENSE_COST_BEHAVIOR_OPTIONS}
            mode="edit"
            expense={{
              id: "123e4567-e89b-42d3-a456-426614174002",
              name: "إعلانات Meta",
              category: "acquisition",
              cost_behavior: "fixed_monthly",
              is_active: true,
            }}
          />
        </section>
      </main>
    </AppShell>
  );
}
