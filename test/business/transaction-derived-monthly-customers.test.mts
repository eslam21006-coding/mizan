import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  deriveMonthlyCustomerCounts,
  loadTransactionDerivedMonthlyCustomerCounts,
} from "../../src/lib/business/monthly-customer-counts.ts";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

type FakeDatabase = Record<string, Row[]>;

class FakeQuery implements PromiseLike<{ data: Row[] | null; error: Error | null; count: number | null }> {
  private readonly rows: Row[];
  private readonly forcedError: Error | null;
  private readonly filters: Filter[] = [];
  private selectedColumns: string[] | null = null;
  private wantsCount = false;
  private head = false;
  private orderColumn: string | null = null;
  private orderAscending = true;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;

  constructor(rows: Row[], forcedError: Error | null = null) {
    this.rows = rows;
    this.forcedError = forcedError;
  }

  select(columns: string, options?: { count?: string; head?: boolean }) {
    this.selectedColumns = columns.split(",").map((column) => column.trim());
    this.wantsCount = options?.count === "exact";
    this.head = options?.head === true;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gt(column: string, value: number) {
    this.filters.push((row) => Number(row[column]) > value);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? "") >= value);
    return this;
  }

  lt(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? "") < value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  private execute() {
    if (this.forcedError) {
      return { data: null, error: this.forcedError, count: null };
    }

    let rows = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    const count = this.wantsCount ? rows.length : null;

    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.orderAscending ? 1 : -1;
      rows = [...rows].sort((left, right) =>
        String(left[column] ?? "").localeCompare(String(right[column] ?? "")) * direction,
      );
    }

    if (this.rangeStart !== null && this.rangeEnd !== null) {
      rows = rows.slice(this.rangeStart, this.rangeEnd + 1);
    }

    if (this.selectedColumns) {
      const columns = this.selectedColumns;
      rows = rows.map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column]])),
      );
    }

    return { data: this.head ? null : rows, error: null, count };
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable; this fake mirrors that contract.
  then<TResult1 = { data: Row[] | null; error: Error | null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: Error | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  private readonly database: FakeDatabase;
  private readonly errorTables: Set<string>;

  constructor(database: FakeDatabase, errorTables = new Set<string>()) {
    this.database = database;
    this.errorTables = errorTables;
  }

  from(table: string) {
    return new FakeQuery(
      this.database[table] ?? [],
      this.errorTables.has(table) ? new Error(`forced ${table} error`) : null,
    );
  }
}

function transaction(
  id: string,
  email: string,
  date: string,
  transactionType = "collection",
  outcome = "successful",
) {
  return {
    id,
    business_id: "business-a",
    customer_email: email,
    transaction_date: date,
    amount_collected: 10,
    transaction_type: transactionType,
    normalized_outcome: outcome,
  };
}

test("transaction-derived counts dedupe repeat payments and keep only first-time acquisitions as new", async () => {
  const fake = new FakeSupabase({
    customer_transactions: [
      transaction("1", "alice@example.com", "2026-07-01"),
      transaction("2", "alice@example.com", "2026-07-05"),
      transaction("3", "bob@example.com", "2026-07-10"),
      transaction("4", "bob@example.com", "2026-07-12", "refund"),
      transaction("5", "carol@example.com", "2026-06-30"),
      transaction("6", "dave@example.com", "2026-07-20", "refund"),
      transaction("7", "ignored@example.com", "2026-07-21", "collection", "failed"),
    ],
    customer_acquisition_cohorts: [
      { business_id: "business-a", customer_email: "alice@example.com", cohort_month: "2026-07-01" },
      { business_id: "business-a", customer_email: "bob@example.com", cohort_month: "2026-06-01" },
      { business_id: "business-a", customer_email: "carol@example.com", cohort_month: "2026-06-01" },
    ],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(
    fake as never,
    "business-a",
    "2026-07-01",
  );

  assert.equal(result.available, true);
  if (!result.available) return;
  assert.equal(result.positiveCollectionRows, 3);
  assert.deepEqual(result.counts, { newCustomers: 1, totalPayingCustomers: 2 });
});

test("refund-only or empty months preserve the manual-count fallback instead of inventing zero", async () => {
  const fake = new FakeSupabase({
    customer_transactions: [transaction("1", "refund@example.com", "2026-07-02", "refund")],
    customer_acquisition_cohorts: [],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(
    fake as never,
    "business-a",
    "2026-07-01",
  );

  assert.deepEqual(result, {
    available: false,
    counts: null,
    positiveCollectionRows: 0,
    dataLoadError: false,
  });
});

test("paying-customer derivation paginates beyond one thousand transactions without double-counting", async () => {
  const repeated = Array.from({ length: 1_001 }, (_, index) =>
    transaction(String(index + 1).padStart(4, "0"), "repeat@example.com", "2026-07-10"),
  );
  const fake = new FakeSupabase({
    customer_transactions: [
      ...repeated,
      transaction("2000", "second@example.com", "2026-07-11"),
    ],
    customer_acquisition_cohorts: [
      { business_id: "business-a", customer_email: "repeat@example.com", cohort_month: "2026-07-01" },
      { business_id: "business-a", customer_email: "second@example.com", cohort_month: "2026-07-01" },
    ],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(
    fake as never,
    "business-a",
    "2026-07-01",
  );

  assert.equal(result.available, true);
  if (!result.available) return;
  assert.equal(result.positiveCollectionRows, 1_002);
  assert.deepEqual(result.counts, { newCustomers: 2, totalPayingCustomers: 2 });
});

test("new customer identities must also be paying identities in the acquisition month", () => {
  assert.throws(
    () => deriveMonthlyCustomerCounts(["payer@example.com"], ["other@example.com"]),
    /positive collection/,
  );
});

test("customer-count data errors fail closed rather than falling back to stale manual counts", async () => {
  const fake = new FakeSupabase(
    { customer_transactions: [], customer_acquisition_cohorts: [] },
    new Set(["customer_transactions"]),
  );

  const result = await loadTransactionDerivedMonthlyCustomerCounts(
    fake as never,
    "business-a",
    "2026-07-01",
  );
  assert.equal(result.dataLoadError, true);
  assert.equal(result.available, false);
});

test("monthly UI and dashboard read derived counts while the database save RPC remains authoritative", async () => {
  const [pageSource, formSource, actionSource, dashboardSource, migrationSource] = await Promise.all([
    readFile("src/app/(app)/businesses/[businessId]/monthly/page.tsx", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/monthly/monthly-entry-form.tsx", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/monthly/actions.ts", "utf8"),
    readFile("src/lib/business/dashboard-month.ts", "utf8"),
    readFile("supabase/migrations/20260906064500_transaction_derived_monthly_customer_counts.sql", "utf8"),
  ]);

  assert.match(pageSource, /loadTransactionDerivedMonthlyCustomerCounts/);
  assert.match(pageSource, /customerCountsDerived=\{customerCountsDerived\}/);
  assert.match(formSource, /محسوب تلقائيًا من سجل المعاملات/);
  assert.match(formSource, /type="hidden" name="new_customers"/);
  assert.doesNotMatch(actionSource, /loadTransactionDerivedMonthlyCustomerCounts/);
  assert.match(actionSource, /target_new_customers: newCustomers\.value/);
  assert.match(actionSource, /target_total_paying_customers: payingCustomers\.value/);
  assert.match(dashboardSource, /new_customers: derivedCustomerCounts\.counts\.newCustomers/);
  assert.match(dashboardSource, /total_paying_customers: derivedCustomerCounts\.counts\.totalPayingCustomers/);
  assert.match(migrationSource, /monthly-customer-counts:/);
  assert.match(migrationSource, /create trigger lock_customer_transaction_monthly_counts/);
  assert.match(migrationSource, /effective_new_customers := derived_new_customers/);
  assert.match(migrationSource, /effective_total_paying_customers/);
});
