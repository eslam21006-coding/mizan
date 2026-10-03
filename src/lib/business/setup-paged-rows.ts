/** The largest page requested from Supabase for Setup readiness records. */
export const SETUP_READ_PAGE_SIZE = 1000;

type SetupPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

type SetupReadResult<T> =
  | { data: T[]; error: null }
  | { data: null; error: Error | { message: string } };

/**
 * Reads every row in stable, caller-defined order, including exact page boundaries.
 *
 * Supabase can enforce a project-specific maximum below the requested page size.
 * Exact counts and offsets advanced by the *returned* length prevent silent
 * truncation in that case. Every caller must provide a deterministic order.
 * A failed or incomplete page fails closed rather than fabricating Setup readiness.
 */
export async function readAllSetupPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SetupPage<T>>,
): Promise<SetupReadResult<T>> {
  const rows: T[] = [];
  let expectedCount: number | null = null;

  while (true) {
    const page = await fetchPage(rows.length, rows.length + SETUP_READ_PAGE_SIZE - 1);
    if (page.error) return { data: null, error: page.error };
    if (!page.data) return { data: null, error: new Error("Setup read returned no data.") };
    if (typeof page.count === "number") {
      if (expectedCount !== null && page.count !== expectedCount) {
        return { data: null, error: new Error("Setup records changed during paginated read.") };
      }
      expectedCount = page.count;
    }
    if (page.data.length === 0) {
      if (expectedCount !== null && rows.length < expectedCount) {
        return { data: null, error: new Error("Setup read ended before all records were loaded.") };
      }
      return { data: rows, error: null };
    }

    rows.push(...page.data);
    if (expectedCount !== null) {
      if (rows.length > expectedCount) {
        return { data: null, error: new Error("Setup read exceeded the expected record count.") };
      }
      if (rows.length === expectedCount) return { data: rows, error: null };
    } else if (page.data.length < SETUP_READ_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}
