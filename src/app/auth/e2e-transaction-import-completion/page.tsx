import { notFound } from "next/navigation";
import { TransactionImportCompletionCard } from "@/app/(app)/businesses/[businessId]/customers/import/transaction-import-completion-card";
import type { TransactionImportCompletionSummary } from "@/lib/business/transaction-import-completion";

const NEW_ROWS_SUMMARY: TransactionImportCompletionSummary = {
  requestedTokenCount: 12,
  persistedInsertedCount: 9,
  sessionUniqueCustomerCount: 7,
  sessionFirstTransactionDate: "2026-01-10",
  sessionLastTransactionDate: "2026-09-05",
  sessionNetCashCollected: "8450.25",
  businessTransactionCount: 1284,
  businessUniqueCustomerCount: 436,
  businessFirstTransactionDate: "2023-01-12",
  businessLastTransactionDate: "2026-09-05",
  businessNetCashCollected: "218750.4",
};

const DUPLICATE_ONLY_SUMMARY: TransactionImportCompletionSummary = {
  ...NEW_ROWS_SUMMARY,
  requestedTokenCount: 12,
  persistedInsertedCount: 0,
  sessionUniqueCustomerCount: 0,
  sessionFirstTransactionDate: null,
  sessionLastTransactionDate: null,
  sessionNetCashCollected: "0",
};

type FixturePageProps = {
  searchParams: Promise<{ state?: string }>;
};

/** CI-only fixture for verified new-row and duplicate-only transaction import completion states. */
export default async function TransactionImportCompletionFixture({ searchParams }: FixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();
  const query = await searchParams;
  const duplicateOnly = query.state === "duplicates";

  return (
    <main className="page-stack" style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <TransactionImportCompletionCard
        businessId="fixture-business"
        baseCurrency="USD"
        insertedCount={duplicateOnly ? 0 : 9}
        duplicateCount={duplicateOnly ? 12 : 3}
        ignoredDetailRows={17}
        invalidRows={0}
        summary={duplicateOnly ? DUPLICATE_ONLY_SUMMARY : NEW_ROWS_SUMMARY}
      />
    </main>
  );
}
