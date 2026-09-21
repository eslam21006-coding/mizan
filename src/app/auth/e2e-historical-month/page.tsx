import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HistoricalCorrectionNavigation } from "@/app/(app)/businesses/[businessId]/monthly/correction/historical-correction-navigation";
import { HistoricalCorrectionSuccess } from "@/app/(app)/businesses/[businessId]/monthly/historical-correction-success";
import { HistoricalMonthState } from "@/app/(app)/businesses/[businessId]/monthly/historical-month-state";

export const dynamic = "force-dynamic";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

/** CI-only fixture for N32/N33 historical month state and correction navigation. */
export default function HistoricalMonthFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const businessId = "123e4567-e89b-42d3-a456-426614174000";

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار الشهر التاريخي">
        <HistoricalCorrectionNavigation
          businessId={businessId}
          businessName="بزنس الاختبار"
          baseCurrency="USD"
          timezone="Africa/Cairo"
          monthKey="2026-07"
          monthLabel="يوليو ٢٠٢٦"
        />

        <HistoricalCorrectionSuccess monthLabel="يوليو ٢٠٢٦" />

        <HistoricalMonthState
          businessId={businessId}
          monthKey="2026-07"
          monthLabel="يوليو ٢٠٢٦"
          canManage
        />
      </section>
    </AppShell>
  );
}
