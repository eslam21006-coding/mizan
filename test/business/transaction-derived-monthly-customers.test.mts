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
type FakeQueryResult = { data: Row[] | null; error: Error | null; count: number | null };

class FakeQuery implements PromiseLike<FakeQueryResult> {
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

  /** Records Supabase-style selected columns and exact-count/head options. */
  select(columns: string, options?: { count?: string; head?: boolean }) {
    this.selectedColumns = columns.split(",").map((column) => column.trim());
    this.wantsCount = options?.count === "exact";
    this.head = options?.head === true;
    return this;
  }

  /** Adds an equality predicate. */
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  /** Adds a numeric greater-than predicate. */
  gt(column: string, value: number) {
    this.filters.push((row) => Number(row[column]) > value);
    return this;
  }

  /** Adds a string/date greater-than-or-equal predicate. */
  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? "") >= value);
    return this;
  }

  /** Adds a string/date less-than predicate. */
  lt(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? "") < value);
    return this;
  }

  /** Records deterministic ordering for paginated reads. */
  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  /** Records an inclusive Supabase range. */
  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  /** Executes accumulated query operations against the in-memory table. */
  private execute(): FakeQueryResult {
    if (this.forcedError) return { data: null, error: this.forcedError, count: null };

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

  /** Mirrors Supabase maybeSingle for transaction-history status reads. */
  async maybeSingle() {
    const result = this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data ?? [];
    if (rows.length > 1) return { data: null, error: new Error("multiple rows") };
    return { data: rows[0] ?? null, error: null };
  }

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are intentionally thenable; this fake mirrors that contract.
  then<TResult1 = FakeQueryResult, TResult2 = never>(
    onfulfilled?: ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class FakeSupabase {
  constructor(
    private readonly database: FakeDatabase,
    private readonly errorTables = new Set<string>(),
  ) {}

  /** Creates a fake table query and optionally forces that table to fail. */
  from(table: string) {
    return new FakeQuery(
      this.database[table] ?? [],
      this.errorTables.has(table) ? new Error(`forced ${table} error`) : null,
    );
  }
}

/** Builds one normalized transaction fixture for the selected test business. */
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

/** Returns an explicit complete-history fixture. */
function completeHistoryStatus() {
  return [{ business_id: "business-a", is_complete: true }];
}

test("complete history dedupes repeat payments and derives only true first-time acquisitions", async () => {
  const fake = new FakeSupabase({
    business_transaction_history_status: completeHistoryStatus(),
    customer_transactions: [
      transaction("1", "alice@example.com", "2026-07-01"),
      transaction("2", "alice@example.com", "2026-07-05"),
      transaction("3", "bob@example.com", "2026-07-10"),
      transaction("4", "bob@example.com", "2026-07-12", "refund"),
      transaction("5", "carol@example.com", "2026-06-30"),
      transaction("6", "ignored@example.com", "2026-07-21", "collection", "failed"),
    ],
    customer_acquisition_cohorts: [
      { business_id: "business-a", customer_email: "alice@example.com", cohort_month: "2026-07-01" },
      { business_id: "business-a", customer_email: "bob@example.com", cohort_month: "2026-06-01" },
    ],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(fake as never, "business-a", "2026-07-01");
  assert.equal(result.available, true);
  if (!result.available) return;
  assert.equal(result.positiveCollectionRows, 3);
  assert.equal(result.transactionHistoryComplete, true);
  assert.deepEqual(result.counts, { newCustomers: 1, totalPayingCustomers: 2 });
});

test("incomplete or missing history status still derives paying customers but withholds New Customers", async () => {
  for (const statusRows of [
    [{ business_id: "business-a", is_complete: false }],
    [],
  ]) {
    const fake = new FakeSupabase({
      business_transaction_history_status: statusRows,
      customer_transactions: [
        transaction("1", "old@example.com", "2026-07-01"),
        transaction("2", "old@example.com", "2026-07-05"),
        transaction("3", "second@example.com", "2026-07-10"),
      ],
      customer_acquisition_cohorts: [
        { business_id: "business-a", customer_email: "old@example.com", cohort_month: "2026-07-01" },
        { business_id: "business-a", customer_email: "second@example.com", cohort_month: "2026-07-01" },
      ],
    });

    const result = await loadTransactionDerivedMonthlyCustomerCounts(fake as never, "business-a", "2026-07-01");
    assert.equal(result.available, true);
    if (!result.available) continue;
    assert.equal(result.transactionHistoryComplete, false);
    assert.deepEqual(result.counts, { newCustomers: null, totalPayingCustomers: 2 });
  }
});

test("refund-only or empty months preserve manual fallback instead of inventing zero", async () => {
  const fake = new FakeSupabase({
    customer_transactions: [transaction("1", "refund@example.com", "2026-07-02", "refund")],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(fake as never, "business-a", "2026-07-01");
  assert.deepEqual(result, {
    available: false,
    counts: null,
    positiveCollectionRows: 0,
    transactionHistoryComplete: null,
    dataLoadError: false,
  });
});

test("paying-customer derivation paginates beyond one thousand transactions without double-counting", async () => {
  const repeated = Array.from({ length: 1_001 }, (_, index) =>
    transaction(String(index + 1).padStart(4, "0"), "repeat@example.com", "2026-07-10"),
  );
  const fake = new FakeSupabase({
    business_transaction_history_status: completeHistoryStatus(),
    customer_transactions: [...repeated, transaction("2000", "second@example.com", "2026-07-11")],
    customer_acquisition_cohorts: [
      { business_id: "business-a", customer_email: "repeat@example.com", cohort_month: "2026-07-01" },
      { business_id: "business-a", customer_email: "second@example.com", cohort_month: "2026-07-01" },
    ],
  });

  const result = await loadTransactionDerivedMonthlyCustomerCounts(fake as never, "business-a", "2026-07-01");
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

test("transaction or history-status read errors fail closed", async () => {
  for (const errorTable of ["customer_transactions", "business_transaction_history_status"]) {
    const fake = new FakeSupabase(
      {
        business_transaction_history_status: completeHistoryStatus(),
        customer_transactions: [transaction("1", "payer@example.com", "2026-07-01")],
      },
      new Set([errorTable]),
    );

    const result = await loadTransactionDerivedMonthlyCustomerCounts(fake as never, "business-a", "2026-07-01");
    assert.equal(result.dataLoadError, true);
    assert.equal(result.available, false);
  }
});

test("UI, dashboard, database guard, and test matrices preserve the history-completeness boundary", async () => {
  const [
    pageSource,
    formSource,
    actionSource,
    dashboardSource,
    originalMigrationSource,
    guardMigrationSource,
    importPageSource,
    importActionSource,
    packageSource,
    derivedMatrixSource,
    historyMatrixSource,
  ] = await Promise.all([
    readFile("src/app/(app)/businesses/[businessId]/monthly/page.tsx", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/monthly/monthly-entry-form.tsx", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/monthly/actions.ts", "utf8"),
    readFile("src/lib/business/dashboard-month.ts", "utf8"),
    readFile("supabase/migrations/20260906064500_transaction_derived_monthly_customer_counts.sql", "utf8"),
    readFile("supabase/migrations/20260906123000_transaction_history_completeness_guard.sql", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/customers/import/page.tsx", "utf8"),
    readFile("src/app/(app)/businesses/[businessId]/customers/import/actions.ts", "utf8"),
    readFile("package.json", "utf8"),
    readFile("test/rls/run-transaction-derived-monthly-matrix.mjs", "utf8"),
    readFile("test/rls/run-transaction-history-completeness-matrix.mjs", "utf8"),
  ]);

  assert.match(pageSource, /payingCustomersDerived/);
  assert.match(pageSource, /newCustomersDerived/);
  assert.match(pageSource, /customerCountsDerived=\{newCustomersDerived\}/);
  assert.match(pageSource, /period\?\.new_customers/);
  assert.match(formSource, /محسوب تلقائيًا من سجل المعاملات/);
  assert.doesNotMatch(actionSource, /loadTransactionDerivedMonthlyCustomerCounts/);
  assert.match(actionSource, /target_new_customers: newCustomers\.value/);
  assert.match(actionSource, /target_total_paying_customers: payingCustomers\.value/);
  assert.match(dashboardSource, /derivedCustomerCounts\.counts\.newCustomers === null/);
  assert.match(dashboardSource, /total_paying_customers: derivedCustomerCounts\.counts\.totalPayingCustomers/);
  assert.match(originalMigrationSource, /monthly-customer-counts:/);
  assert.match(guardMigrationSource, /business_transaction_history_status/);
  assert.match(guardMigrationSource, /when history_complete then counts\.new_customers/);
  assert.match(guardMigrationSource, /effective_total_paying_customers := derived_total_paying_customers/);
  assert.match(guardMigrationSource, /if history_complete then/);
  assert.match(guardMigrationSource, /set_transaction_history_complete/);
  assert.match(importPageSource, /أؤكد أنني رفعت كل تاريخ المعاملات المتاح للبزنس/);
  assert.match(importActionSource, /set_transaction_history_complete/);
  assert.match(packageSource, /run-transaction-history-completeness-matrix\.mjs/);
  assert.match(derivedMatrixSource, /20260906064500_transaction_derived_monthly_customer_counts\.sql/);
  assert.match(derivedMatrixSource, /MIZAN_SAVE_LOCK_HELD/);
  assert.match(derivedMatrixSource, /MIZAN_INSERT_LOCK_HELD/);
  assert.match(derivedMatrixSource, /wait_event = 'advisory'/);
  assert.match(historyMatrixSource, /20260906123000_transaction_history_completeness_guard\.sql/);
  assert.match(historyMatrixSource, /transaction-history-completeness\.test\.sql/);
});
