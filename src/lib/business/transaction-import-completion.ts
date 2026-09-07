export type TransactionImportCompletionSummary = {
  requestedTokenCount: number;
  persistedInsertedCount: number;
  sessionUniqueCustomerCount: number;
  sessionFirstTransactionDate: string | null;
  sessionLastTransactionDate: string | null;
  sessionNetCashCollected: string;
  businessTransactionCount: number;
  businessUniqueCustomerCount: number;
  businessFirstTransactionDate: string | null;
  businessLastTransactionDate: string | null;
  businessNetCashCollected: string;
};

function parseNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function parseNullableIsoDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

function parseDecimalText(value: unknown) {
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  return value;
}

/** Parses the database-authoritative completion payload and fails closed on malformed transport data. */
export function parseTransactionImportCompletionSummary(
  data: unknown,
): TransactionImportCompletionSummary | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const requestedTokenCount = parseNonNegativeInteger(record.requested_token_count);
  const persistedInsertedCount = parseNonNegativeInteger(record.persisted_inserted_count);
  const sessionUniqueCustomerCount = parseNonNegativeInteger(record.session_unique_customer_count);
  const businessTransactionCount = parseNonNegativeInteger(record.business_transaction_count);
  const businessUniqueCustomerCount = parseNonNegativeInteger(record.business_unique_customer_count);
  const sessionFirstTransactionDate = parseNullableIsoDate(record.session_first_transaction_date);
  const sessionLastTransactionDate = parseNullableIsoDate(record.session_last_transaction_date);
  const businessFirstTransactionDate = parseNullableIsoDate(record.business_first_transaction_date);
  const businessLastTransactionDate = parseNullableIsoDate(record.business_last_transaction_date);
  const sessionNetCashCollected = parseDecimalText(record.session_net_cash_collected);
  const businessNetCashCollected = parseDecimalText(record.business_net_cash_collected);

  if (
    requestedTokenCount === null ||
    persistedInsertedCount === null ||
    sessionUniqueCustomerCount === null ||
    businessTransactionCount === null ||
    businessUniqueCustomerCount === null ||
    sessionFirstTransactionDate === undefined ||
    sessionLastTransactionDate === undefined ||
    businessFirstTransactionDate === undefined ||
    businessLastTransactionDate === undefined ||
    sessionNetCashCollected === null ||
    businessNetCashCollected === null
  ) {
    return null;
  }

  if (persistedInsertedCount > requestedTokenCount) return null;
  if (sessionUniqueCustomerCount > persistedInsertedCount) return null;
  if (businessUniqueCustomerCount > businessTransactionCount) return null;
  if ((persistedInsertedCount === 0) !== (sessionFirstTransactionDate === null)) return null;
  if ((persistedInsertedCount === 0) !== (sessionLastTransactionDate === null)) return null;
  if ((businessTransactionCount === 0) !== (businessFirstTransactionDate === null)) return null;
  if ((businessTransactionCount === 0) !== (businessLastTransactionDate === null)) return null;

  return {
    requestedTokenCount,
    persistedInsertedCount,
    sessionUniqueCustomerCount,
    sessionFirstTransactionDate,
    sessionLastTransactionDate,
    sessionNetCashCollected,
    businessTransactionCount,
    businessUniqueCustomerCount,
    businessFirstTransactionDate,
    businessLastTransactionDate,
    businessNetCashCollected,
  };
}
