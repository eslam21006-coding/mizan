import Link from "next/link";
import { notFound } from "next/navigation";
import { TransactionImportCompletionCard } from "@/app/(app)/businesses/[businessId]/customers/import/transaction-import-completion-card";
import { TransactionImportNavigation } from "@/app/(app)/businesses/[businessId]/customers/import/transaction-import-navigation";
import type { TransactionImportCompletionSummary } from "@/lib/business/transaction-import-completion";
import {
  parseTransactionImportReturnOrigin,
  transactionImportReturnAction,
} from "@/lib/transaction-import-navigation";

const DEFAULT_BUSINESS_ID = "fixture-business";
const JOURNEY_BUSINESS_ID = "00000000-0000-4000-8000-000000000025";

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
  searchParams: Promise<{
    state?: string | string[];
    stage?: string | string[];
    businessId?: string | string[];
    origin?: string | string[];
    month?: string | string[];
  }>;
};

/** CI-only fixture for verified new-row and duplicate-only transaction import completion states. */
export default async function TransactionImportCompletionFixture({ searchParams }: FixturePageProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") notFound();
  const query = await searchParams;
  const duplicateOnly = query.state === "duplicates";
  const entryStage = query.stage === "entry";
  const businessId =
    query.businessId === JOURNEY_BUSINESS_ID ? JOURNEY_BUSINESS_ID : DEFAULT_BUSINESS_ID;
  const returnOrigin = parseTransactionImportReturnOrigin({
    origin: query.origin,
    month: query.month,
  });
  const returnAction = transactionImportReturnAction(returnOrigin, businessId);
  const completionParams = new URLSearchParams({ stage: "complete" });
  if (businessId === JOURNEY_BUSINESS_ID) {
    completionParams.set("businessId", businessId);
  }
  if (returnOrigin) {
    completionParams.set("origin", returnOrigin.origin);
    if ("month" in returnOrigin && returnOrigin.month) {
      completionParams.set("month", returnOrigin.month);
    }
  }

  return (
    <main className="page-stack" style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <TransactionImportNavigation
        businessId={businessId}
        businessName="Fixture Business"
        returnOrigin={returnOrigin}
      />
      {entryStage ? (
        <section aria-labelledby="transaction-import-entry-title">
          <h1 id="transaction-import-entry-title">استيراد معاملات العملاء</h1>
          <p>واجهة اختبار معزولة لمحاكاة اكتمال الاستيراد بعد الحفاظ على سياق العودة.</p>
          <Link href={`/auth/e2e-transaction-import-completion?${completionParams.toString()}`}>
            محاكاة اكتمال الاستيراد
          </Link>
        </section>
      ) : (
        <TransactionImportCompletionCard
          businessId={businessId}
          baseCurrency="USD"
          insertedCount={duplicateOnly ? 0 : 9}
          duplicateCount={duplicateOnly ? 12 : 3}
          ignoredDetailRows={17}
          invalidRows={0}
          summary={duplicateOnly ? DUPLICATE_ONLY_SUMMARY : NEW_ROWS_SUMMARY}
          returnAction={returnAction}
        />
      )}
    </main>
  );
}
