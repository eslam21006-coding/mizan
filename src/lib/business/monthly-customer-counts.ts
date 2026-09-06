import type { createSupabaseServerClient } from "../supabase/server";
import { parseMonthKey, shiftMonthKey } from "./monthly.ts";

const CUSTOMER_TRANSACTION_PAGE_SIZE = 1_000;

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DerivedMonthlyCustomerCounts = {
  newCustomers: number | null;
  totalPayingCustomers: number;
};

export type MonthlyCustomerCountsLoadResult =
  | {
      available: true;
      counts: DerivedMonthlyCustomerCounts;
      positiveCollectionRows: number;
      transactionHistoryComplete: boolean;
      dataLoadError: false;
    }
  | {
      available: false;
      counts: null;
      positiveCollectionRows: 0;
      transactionHistoryComplete: null;
      dataLoadError: false;
    }
  | {
      available: false;
      counts: null;
      positiveCollectionRows: null;
      transactionHistoryComplete: null;
      dataLoadError: true;
    };

/** Normalizes a customer email into Mizan's case-insensitive identity key. */
function normalizedCustomerEmail(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Counts unique paying and newly acquired customers from normalized email identities.
 * New-customer identities must be a subset of customers with a positive collection in the month.
 */
export function deriveMonthlyCustomerCounts(
  payingCustomerEmails: readonly unknown[],
  newCustomerEmails: readonly unknown[],
): { newCustomers: number; totalPayingCustomers: number } {
  const paying = new Set<string>();
  for (const value of payingCustomerEmails) {
    const email = normalizedCustomerEmail(value);
    if (!email) throw new Error("Monthly paying-customer identity is missing.");
    paying.add(email);
  }

  const newlyAcquired = new Set<string>();
  for (const value of newCustomerEmails) {
    const email = normalizedCustomerEmail(value);
    if (!email) throw new Error("Monthly new-customer identity is missing.");
    if (!paying.has(email)) {
      throw new Error("A newly acquired customer must have a positive collection in the acquisition month.");
    }
    newlyAcquired.add(email);
  }

  return {
    newCustomers: newlyAcquired.size,
    totalPayingCustomers: paying.size,
  };
}

/** Counts unique valid paying-customer identities without making any acquisition-date claim. */
function countUniquePayingCustomers(values: readonly unknown[]) {
  const paying = new Set<string>();
  for (const value of values) {
    const email = normalizedCustomerEmail(value);
    if (!email) throw new Error("Monthly paying-customer identity is missing.");
    paying.add(email);
  }
  return paying.size;
}

/** Resolves an exact month-start date into an inclusive start and exclusive end bound. */
function resolveMonthBounds(monthStart: string) {
  const parsed = parseMonthKey(monthStart.slice(0, 7));
  if (!parsed || parsed.monthStart !== monthStart) return null;
  const nextMonthKey = shiftMonthKey(parsed.monthKey, 1);
  return nextMonthKey ? { start: monthStart, end: `${nextMonthKey}-01` } : null;
}

/** Loads the business-level trust flag that permits earliest-known payments to define New Customers. */
async function loadTransactionHistoryCompleteness(
  supabase: ServerSupabaseClient,
  businessId: string,
) {
  const { data, error } = await supabase
    .from("business_transaction_history_status")
    .select("is_complete")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) return null;
  return data?.is_complete === true;
}

/** Loads every successful positive-collection customer identity for one business month. */
async function loadPositiveCollectionEmails(
  supabase: ServerSupabaseClient,
  businessId: string,
  start: string,
  end: string,
) {
  const emails: string[] = [];

  for (let offset = 0; ; offset += CUSTOMER_TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customer_transactions")
      .select("customer_email")
      .eq("business_id", businessId)
      .eq("normalized_outcome", "successful")
      .eq("transaction_type", "collection")
      .gt("amount_collected", 0)
      .gte("transaction_date", start)
      .lt("transaction_date", end)
      .order("id", { ascending: true })
      .range(offset, offset + CUSTOMER_TRANSACTION_PAGE_SIZE - 1);

    if (error) return null;
    const rows = data ?? [];
    for (const row of rows) emails.push(String(row.customer_email ?? ""));
    if (rows.length < CUSTOMER_TRANSACTION_PAGE_SIZE) break;
  }

  return emails;
}

/** Loads customer identities whose acquisition cohort starts in the selected month. */
async function loadNewCustomerEmails(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
) {
  const emails: string[] = [];

  for (let offset = 0; ; offset += CUSTOMER_TRANSACTION_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("customer_acquisition_cohorts")
      .select("customer_email")
      .eq("business_id", businessId)
      .eq("cohort_month", monthStart)
      .order("customer_email", { ascending: true })
      .range(offset, offset + CUSTOMER_TRANSACTION_PAGE_SIZE - 1);

    if (error) return null;
    const rows = data ?? [];
    for (const row of rows) emails.push(String(row.customer_email ?? ""));
    if (rows.length < CUSTOMER_TRANSACTION_PAGE_SIZE) break;
  }

  return emails;
}

/**
 * Uses imported successful positive collections as an authoritative Paying Customer source whenever
 * the selected month contains such collections. New Customers are returned only when the business has
 * explicitly confirmed that imported history covers the business from its earliest available payment.
 * Months without imported positive collections retain the existing manual-entry fallback.
 */
export async function loadTransactionDerivedMonthlyCustomerCounts(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<MonthlyCustomerCountsLoadResult> {
  const bounds = resolveMonthBounds(monthStart);
  if (!bounds) {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: null,
      transactionHistoryComplete: null,
      dataLoadError: true,
    };
  }

  const { count, error: countError } = await supabase
    .from("customer_transactions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("normalized_outcome", "successful")
    .eq("transaction_type", "collection")
    .gt("amount_collected", 0)
    .gte("transaction_date", bounds.start)
    .lt("transaction_date", bounds.end);

  if (countError || count === null) {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: null,
      transactionHistoryComplete: null,
      dataLoadError: true,
    };
  }

  if (count === 0) {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: 0,
      transactionHistoryComplete: null,
      dataLoadError: false,
    };
  }

  const historyComplete = await loadTransactionHistoryCompleteness(supabase, businessId);
  if (historyComplete === null) {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: null,
      transactionHistoryComplete: null,
      dataLoadError: true,
    };
  }

  const payingEmails = await loadPositiveCollectionEmails(
    supabase,
    businessId,
    bounds.start,
    bounds.end,
  );
  if (!payingEmails) {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: null,
      transactionHistoryComplete: null,
      dataLoadError: true,
    };
  }

  try {
    const totalPayingCustomers = countUniquePayingCustomers(payingEmails);
    if (!historyComplete) {
      return {
        available: true,
        counts: { newCustomers: null, totalPayingCustomers },
        positiveCollectionRows: count,
        transactionHistoryComplete: false,
        dataLoadError: false,
      };
    }

    const newEmails = await loadNewCustomerEmails(supabase, businessId, monthStart);
    if (!newEmails) {
      return {
        available: false,
        counts: null,
        positiveCollectionRows: null,
        transactionHistoryComplete: null,
        dataLoadError: true,
      };
    }

    const derived = deriveMonthlyCustomerCounts(payingEmails, newEmails);
    return {
      available: true,
      counts: derived,
      positiveCollectionRows: count,
      transactionHistoryComplete: true,
      dataLoadError: false,
    };
  } catch {
    return {
      available: false,
      counts: null,
      positiveCollectionRows: null,
      transactionHistoryComplete: null,
      dataLoadError: true,
    };
  }
}
