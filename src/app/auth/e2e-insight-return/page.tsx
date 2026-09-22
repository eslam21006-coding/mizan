import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/page-heading";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { parseReturnOrigin } from "@/lib/return-origin";

const businessId = "123e4567-e89b-42d3-a456-426614174000";
const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

type InsightReturnFixtureProps = {
  searchParams: Promise<{
    origin?: string | string[];
    month?: string | string[];
    insight_rule?: string | string[];
    insight_subject?: string | string[];
  }>;
};

/** CI-only fixture for the structured N50 originating-insight Return banner. */
export default async function InsightReturnE2eFixturePage({
  searchParams,
}: InsightReturnFixtureProps) {
  await connection();
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();

  const query = await searchParams;
  const parsed = parseReturnOrigin({
    origin: query.origin,
    month: query.month,
    insight_rule: query.insight_rule,
    insight_subject: query.insight_subject,
  });
  const returnOrigin = parsed?.origin === "insights" ? parsed : null;

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <PageHeading
          title="مراجعة الملاحظة"
          description="واجهة معزولة للتحقق من حلقة العودة إلى الملاحظة الأصلية."
        />
        {returnOrigin && (
          <ReturnContextBanner
            purpose="مراجعة البيانات المرتبطة بهذه الملاحظة"
            origin={returnOrigin}
            context={{ businessId }}
            returnLabel="العودة إلى الملاحظة"
            ariaLabel="سياق العودة إلى الملاحظة"
          />
        )}
      </div>
    </AppShell>
  );
}
