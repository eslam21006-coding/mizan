import { notFound } from "next/navigation";
import { CustomerOverviewShell } from "@/app/(app)/businesses/[businessId]/customers/customer-overview-shell";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000057";

export default function CustomerOverviewE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main className="page-stack">
      <CustomerOverviewShell
        businessId={FIXTURE_BUSINESS_ID}
        businessName="بزنس الاختبار"
        baseCurrency="EGP"
        timezone="Africa/Cairo"
        observedLtv={
          <section aria-label="لوحة قيمة العميل المحققة">
            <h2>Observed LTV / قيمة العميل المحققة حتى الآن</h2>
            <p>1,700 EGP قيمة محققة من سجل المعاملات.</p>
          </section>
        }
        revenueStreams={
          <section aria-label="لوحة مصادر الإيراد">
            <h2>تحليل مصادر الإيراد مدى الحياة</h2>
            <p>Front-End 1,200 EGP · Backend 500 EGP</p>
          </section>
        }
        contribution={
          <section aria-label="لوحة ربح المساهمة">
            <h2>Lifetime Contribution Profit / ربح المساهمة مدى الحياة</h2>
            <p>1,050 EGP بعد التكاليف المرتبطة بالعميل.</p>
          </section>
        }
        customers={
          <section aria-label="لوحة سجل العملاء">
            <h2>العملاء</h2>
            <p>عميلان · خمس معاملات محفوظة.</p>
          </section>
        }
      />
    </main>
  );
}
