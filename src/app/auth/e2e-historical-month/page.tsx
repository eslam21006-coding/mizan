import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoricalCorrectionNavigation } from "@/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-navigation";
import { HistoricalCorrectionSuccess } from "@/app/(app)/businesses/[businessId]/monthly/historical-correction-success";
import { HistoricalMonthState } from "@/app/(app)/businesses/[businessId]/monthly/historical-month-state";
import { AppShell } from "@/components/app-shell";
import { ReturnContextBanner } from "@/components/workflow-recovery";
import { parseMonthKey } from "@/lib/business/monthly";
import { buildHistoricalCorrectionSuccessHref } from "@/lib/historical-correction-navigation";
import { parseMonthlyExternalReturnOrigin } from "@/lib/monthly-return-origin";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};
const BUSINESS_ID = "123e4567-e89b-42d3-a456-426614174000";

type HistoricalMonthFixtureProps = {
  searchParams: Promise<{
    stage?: string | string[];
    month?: string | string[];
    status?: string | string[];
    origin?: string | string[];
    return_month?: string | string[];
    insight_rule?: string | string[];
    insight_subject?: string | string[];
    planner_step?: string | string[];
    planner_goal?: string | string[];
    planner_value?: string | string[];
  }>;
};

/** Formats an exact month key for the Arabic historical workflow fixture. */
function historicalMonthLabel(monthStart: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00.000Z`));
}

/** Renders a fixture Return banner using the same validated Monthly external-origin contract as production. */
function JourneyReturnBanner({
  returnOrigin,
}: {
  returnOrigin: ReturnType<typeof parseMonthlyExternalReturnOrigin>;
}) {
  if (!returnOrigin) return null;

  return (
    <ReturnContextBanner
      purpose={
        returnOrigin.origin === "customer-profitability"
          ? "بيانات مطلوبة في ربحية العميل"
          : "بيانات مطلوبة في مسار العمل السابق"
      }
      origin={returnOrigin}
      context={{ businessId: BUSINESS_ID }}
      returnLabel={
        returnOrigin.origin === "customer-profitability"
          ? "العودة إلى ربحية العميل"
          : "العودة إلى المهمة السابقة"
      }
      ariaLabel="سياق العودة من رحلة التصحيح التاريخي"
    />
  );
}

/** CI-only fixture for historical state, correction navigation, and the N70 end-to-end return journey. */
export default async function HistoricalMonthFixturePage({
  searchParams,
}: HistoricalMonthFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const requestedMonth = Array.isArray(query.month) ? query.month[0] : query.month;
  const selectedMonth = parseMonthKey(requestedMonth) ?? {
    monthKey: "2026-07",
    monthStart: "2026-07-01",
  };
  const monthLabel = historicalMonthLabel(selectedMonth.monthStart);
  const returnOrigin = parseMonthlyExternalReturnOrigin({
    origin: query.origin,
    month: query.return_month ?? query.month,
    insight_rule: query.insight_rule,
    insight_subject: query.insight_subject,
    planner_step: query.planner_step,
    planner_goal: query.planner_goal,
    planner_value: query.planner_value,
  });
  const stage = Array.isArray(query.stage) ? query.stage[0] : query.stage;
  const status = Array.isArray(query.status) ? query.status[0] : query.status;

  if (stage === "journey-correction") {
    const successHref = buildHistoricalCorrectionSuccessHref(
      BUSINESS_ID,
      selectedMonth.monthKey,
      returnOrigin,
    );

    return (
      <AppShell {...fixtureShellProps}>
        <section className="page-stack" aria-label="رحلة التصحيح التاريخي">
          <HistoricalCorrectionNavigation
            businessId={BUSINESS_ID}
            businessName="بزنس الاختبار"
            baseCurrency="USD"
            timezone="Africa/Cairo"
            monthKey={selectedMonth.monthKey}
            monthLabel={monthLabel}
            returnOrigin={returnOrigin}
          />
          <JourneyReturnBanner returnOrigin={returnOrigin} />
          <div>
            <span className="eyebrow">تصحيح تاريخي صريح</span>
            <h1>تصحيح بيانات شهر سابق</h1>
            <p>{monthLabel}</p>
          </div>
          <section aria-label="محاكاة حفظ التصحيح">
            <p>واجهة اختبار فقط — لا يتم تعديل أي بيانات فعلية.</p>
            <Link href={successHref}>محاكاة حفظ التصحيح التاريخي</Link>
          </section>
        </section>
      </AppShell>
    );
  }

  if (stage === "journey-monthly") {
    return (
      <AppShell {...fixtureShellProps}>
        <section className="page-stack" aria-label="رحلة الشهر التاريخي">
          <div>
            <span className="eyebrow">اختبار الشهر التاريخي</span>
            <h1>الإدخال الشهري</h1>
            <p>{monthLabel}</p>
          </div>
          <JourneyReturnBanner returnOrigin={returnOrigin} />
          {status === "corrected" && <HistoricalCorrectionSuccess monthLabel={monthLabel} />}
          <HistoricalMonthState
            businessId={BUSINESS_ID}
            monthKey={selectedMonth.monthKey}
            monthLabel={monthLabel}
            canManage
            returnOrigin={returnOrigin}
          />
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار الشهر التاريخي">
        <HistoricalCorrectionNavigation
          businessId={BUSINESS_ID}
          businessName="بزنس الاختبار"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          monthKey="2026-07"
          monthLabel="يوليو ٢٠٢٦"
        />

        <HistoricalCorrectionSuccess monthLabel="يوليو ٢٠٢٦" />

        <HistoricalMonthState
          businessId={BUSINESS_ID}
          monthKey="2026-07"
          monthLabel="يوليو ٢٠٢٦"
          canManage
        />
      </section>
    </AppShell>
  );
}
