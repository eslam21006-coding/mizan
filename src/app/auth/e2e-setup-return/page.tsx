import { notFound } from "next/navigation";
import { connection } from "next/server";
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
  const returnOrigin = parseSetupReturnOrigin({
    origin: query.origin,
    month: query.month,
  });

  return (
    <AppShell {...fixtureShellProps}>
      <div className="page-stack">
        <PageHeading
          title="مصادر الإيراد"
          description="واجهة معزولة للتحقق من سياق العودة من إعداد مصادر الإيراد."
        />

        {returnOrigin && (
          <ReturnContextBanner
            purpose="إضافة أو تعديل مصدر الإيراد المطلوب للشهر"
            origin={returnOrigin}
            context={{ businessId }}
            returnLabel="العودة إلى الإدخال الشهري"
            ariaLabel="سياق العودة من إعداد مصادر الإيراد"
          />
        )}

        <section className={revenueStyles.panel}>
          <div className={revenueStyles.panelHeading}>
            <div>
              <span className={revenueStyles.kicker}>إعداد مؤقت</span>
              <h2>مصدر إيراد جديد</h2>
            </div>
          </div>
          <p>بعد إكمال الإعداد، ارجع إلى نفس شهر الإدخال الشهري.</p>
        </section>
      </div>
    </AppShell>
  );
}
