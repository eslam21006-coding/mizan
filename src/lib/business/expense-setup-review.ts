import {
  EXPENSE_CATEGORIES,
  resolveExpenseSetupReview,
  type ExpenseCategory,
  type ExpenseCategoryCounts,
} from "./expenses.ts";

export type ActiveExpenseCountResult = {
  count: number | null;
  error: unknown;
};

export type ExpenseSetupReviewPersistenceResult = {
  updated: boolean;
  error: unknown;
};

export type ExpenseSetupReviewConfirmationResult =
  | { kind: "reviewed" }
  | { kind: "review-incomplete" }
  | { kind: "review-failed" };

export type ExpenseSetupReviewDependencies = {
  countActiveExpenses: (category: ExpenseCategory) => Promise<ActiveExpenseCountResult>;
  persistReviewedAt: (reviewedAt: string) => Promise<ExpenseSetupReviewPersistenceResult>;
  now?: () => Date;
};

/**
 * Executes the authoritative Step 3 review decision without depending on framework redirects.
 *
 * Every category count is fetched independently so API row caps cannot convert real expenses into
 * fabricated zeroes. Persistence occurs only after the four-category resolution passes.
 */
export async function executeExpenseSetupReviewConfirmation(
  explicitNoneCategories: readonly ExpenseCategory[],
  dependencies: ExpenseSetupReviewDependencies,
): Promise<ExpenseSetupReviewConfirmationResult> {
  const countResults = await Promise.all(
    EXPENSE_CATEGORIES.map(async (category) => ({
      category,
      result: await dependencies.countActiveExpenses(category),
    })),
  );

  if (countResults.some(({ result }) => result.error || result.count === null)) {
    return { kind: "review-failed" };
  }

  const activeCounts = Object.fromEntries(
    countResults.map(({ category, result }) => [category, result.count ?? 0]),
  ) as Record<ExpenseCategory, number>;

  const resolution = resolveExpenseSetupReview(
    activeCounts as ExpenseCategoryCounts,
    explicitNoneCategories,
  );
  if (!resolution.resolved) {
    return { kind: "review-incomplete" };
  }

  const reviewedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const persistence = await dependencies.persistReviewedAt(reviewedAt);
  if (persistence.error || !persistence.updated) {
    return { kind: "review-failed" };
  }

  return { kind: "reviewed" };
}
