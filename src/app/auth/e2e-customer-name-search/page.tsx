import { notFound } from "next/navigation";
import { CustomerGroupsTable } from "@/app/(app)/businesses/[businessId]/customers/customer-groups-table";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000067";

/** Renders the real customer ledger for deterministic browser verification of name-or-email search. */
export default function CustomerNameSearchE2eFixturePage() {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  return (
    <main className="page-stack">
      <CustomerGroupsTable
        businessId={FIXTURE_BUSINESS_ID}
        baseCurrency="EGP"
        timezone="Africa/Cairo"
      />
    </main>
  );
}
