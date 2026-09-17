import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerCohortLtvTable } from "@/app/(app)/businesses/[businessId]/customers/customer-cohort-ltv-table";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000063";

/** Renders the real cohort table for deterministic browser verification without production customer data. */
export default function CustomerCohortUxE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main className="page-stack">
      <Suspense fallback={<div role="status">جاري تحميل مجموعات العملاء…</div>}>
        <CustomerCohortLtvTable businessId={FIXTURE_BUSINESS_ID} baseCurrency="USD" />
      </Suspense>
    </main>
  );
}
