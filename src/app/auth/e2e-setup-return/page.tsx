import { notFound } from "next/navigation";
import { connection } from "next/server";
import expenseStyles from "@/app/(app)/businesses/[businessId]/expenses/expenses.module.css";
import revenueStyles from "@/app/(app)/businesses/[businessId]/revenue-streams/revenue-streams.module.css";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { parseSetupReturnOrigin } from "@/lib/setup-return-origin";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};
const businessId = "123e4567-e89b-42d3-a456-426614174000";

type SetupReturnFixtureProps = {
  searchParams: Promise<{
    target?: string | string[];
    origin?: string | string[];
    month?: string | string[];
  }>;
};

export default async function SetupReturnE2eFixturePage({
  searchParams,
}: SetupReturnFixtureProps) {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const isExpenses = query.target === "expenses";
  const styles = isExpenses ? expenseStyles : revenueStyles;
  const returnOrigin = parseSetupReturnOrigin({
    origin: query.origin,
    month: query.month,
  });

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <PageHeading
          title={isExpenses ? "هيكل المصروفات" : "مصادر الإيراد"}
          description={
            isExpenses
              ? "واجهة معزولة للتحقق من سياق العودة من إعداد المصروفات."
              : "واجهة معزولة للتحقق من سياق العودة من إعداد مصادر الإيراد."
          }
        />

        {returnOrigin && (
          <ReturnContextBanner
            purpose={
              isExpenses
                ? "إضافة أو تعديل بند المصروف المطلوب للشهر"
                : "إضافة أو تعديل مصدر الإيراد المطلوب للشهر"
            }
            origin={returnOrigin}
            context={{ businessId }}
            returnLabel="العودة إلى الإدخال الشهري"
            ariaLabel={
              isExpenses
                ? "سياق العودة من إعداد المصروفات"
                : "سياق العودة من إعداد مصادر الإيراد"
            }
          />
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.kicker}>إعداد مؤقت</span>
              <h2>{isExpenses ? "بند مصروف جديد" : "مصدر إيراد جديد"}</h2>
            </div>
          </div>
          <p>بعد إكمال الإعداد، ارجع إلى نفس شهر الإدخال الشهري.</p>
        </section>
      </div>
    </AppShell>
  );
}
