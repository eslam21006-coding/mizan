import { notFound } from "next/navigation";
import { MetricAuditDetails } from "@/components/metric-audit";
import { calculateCoreFinancials, type CoreCalculationInput } from "@/lib/business/calculations";
import { createCoreMetricAudits } from "@/lib/business/metric-audit";

const fixtureInput: CoreCalculationInput = {
  revenueStreams: [],
  unallocatedGrossCashCollected: "50000",
  unallocatedRefunds: "0",
  newCustomers: 30,
  totalPayingCustomers: 30,
  canonicalAdSpend: "12000",
  attributedRevenue: null,
  expenses: [
    {
      id: "acquisition",
      name: "Acquisition",
      category: "acquisition",
      behavior: "fixed_monthly",
      inputValue: "12000",
    },
    {
      id: "fulfillment",
      name: "Fulfillment",
      category: "fulfillment",
      behavior: "fixed_monthly",
      inputValue: "6500",
    },
    {
      id: "overhead",
      name: "Overhead",
      category: "overhead",
      behavior: "fixed_monthly",
      inputValue: "4000",
    },
    {
      id: "financial",
      name: "Financial",
      category: "financial",
      behavior: "fixed_monthly",
      inputValue: "2760",
    },
  ],
};

export default function MetricAuditE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const result = calculateCoreFinancials(fixtureInput);
  const audits = createCoreMetricAudits(result, fixtureInput);

  return (
    <main className="page-stack" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div>
        <span className="eyebrow">اختبار قابلية تتبع الأرقام</span>
        <h1>Ultimate CAC</h1>
        <p className="muted-copy">
          هذا المسار معزول لاختبار مكوّن شرح مصدر الرقم، ولا يظهر إلا عند تفعيل وضع اختبار الواجهة.
        </p>
      </div>
      <section className="panel">
        <strong>٨٤٢ USD</strong>
        <MetricAuditDetails audit={audits.ultimateCac} currency="USD" />
      </section>
    </main>
  );
}
