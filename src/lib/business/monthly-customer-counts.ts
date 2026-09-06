import type { createSupabaseServerClient } from "../supabase/server";
import { parseMonthKey, shiftMonthKey } from "./monthly.ts";

const CUSTOMER_TRANSACTION_PAGE_SIZE = 1_000;

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DerivedMonthlyCustomerCounts = {
  newCustomers: number;
  totalPayingCustomers: number;
};

export type MonthlyCustomerCountsLoadResult =
  | {
      available: true;
      counts: DerivedMonthlyCustomerCounts;
      positiveCollectionRows: number;
      dataLoadError: false;
    }
  | {
      available: false;
      counts: null;
      positiveCollectionRows: 0;
      dataLoadError: false;
    }
  | {
      available: false;
      counts: null;
      positiveCollectionRows: null;
      dataLoadError: true;
    };

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
): DerivedMonthlyCustomerCounts {
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

function resolveMonthBounds(monthStart: string) {
  const parsed = parseMonthKey(monthStart.slice(0, 7));
  if (!parsed || parsed.monthStart !== monthStart) return null;
  const nextMonthKey = shiftMonthKey(parsed.monthKey, 1);
  return nextMonthKey ? { start: monthStart, end: `${nextMonthKey}-01` } : null;
}

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
 * Uses imported successful positive collections as an authoritative customer-count source only when
 * that month contains at least one such collection. Months without imported collections retain the
 * existing manual-entry fallback so missing transaction history is never silently interpreted as zero.
 */
export async function loadTransactionDerivedMonthlyCustomerCounts(
  supabase: ServerSupabaseClient,
  businessId: string,
  monthStart: string,
): Promise<MonthlyCustomerCountsLoadResult> {
  const bounds = resolveMonthBounds(monthStart);
  if (!bounds) {
    return { available: false, counts: null, positiveCollectionRows: null, dataLoadError: true };
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
    return { available: false, counts: null, positiveCollectionRows: null, dataLoadError: true };
  }

  if (count === 0) {
    return { available: false, counts: null, positiveCollectionRows: 0, dataLoadError: false };
  }

  const [payingEmails, newEmails] = await Promise.all([
    loadPositiveCollectionEmails(supabase, businessId, bounds.start, bounds.end),
    loadNewCustomerEmails(supabase, businessId, monthStart),
  ]);

  if (!payingEmails || !newEmails) {
    return { available: false, counts: null, positiveCollectionRows: null, dataLoadError: true };
  }

  try {
    return {
      available: true,
      counts: deriveMonthlyCustomerCounts(payingEmails, newEmails),
      positiveCollectionRows: count,
      dataLoadError: false,
    };
  } catch {
    return { available: false, counts: null, positiveCollectionRows: null, dataLoadError: true };
  }
}
