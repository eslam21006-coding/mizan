export type MonthlyWriteFailure = {
  status: number;
  code?: string | null;
};

/**
 * PostgREST reports fetch/transport failures with status 0. At that boundary
 * the client cannot know whether PostgreSQL committed before the response was
 * lost, so Setup must verify persisted state instead of claiming failure.
 */
export function isUncertainMonthlyWriteFailure(
  failure: MonthlyWriteFailure,
): boolean {
  return failure.status === 0;
}
