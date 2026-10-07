export type FirstMonthSaveRecovery =
  | "persisted"
  | "not-persisted"
  | "unavailable";

type SetupIdentityRead =
  | { kind: "loaded"; business: { id: string } }
  | { kind: "not_found" }
  | { kind: "load_error"; business: { id: string } };

type MonthIdentityRead =
  | {
      kind: "loaded";
      selectedMonthKey: string;
      hasSavedPeriod: boolean;
    }
  | {
      kind: "load_error";
      selectedMonthKey: string;
    };

/**
 * Classifies only the independently re-read persisted state after an uncertain
 * save outcome. It never infers that the latest write succeeded merely because
 * the month already existed.
 */
export function resolveFirstMonthSaveRecovery(
  businessId: string,
  monthKey: string,
  setup: SetupIdentityRead,
  month: MonthIdentityRead | null,
): FirstMonthSaveRecovery {
  if (
    setup.kind !== "loaded" ||
    setup.business.id !== businessId ||
    !month ||
    month.kind !== "loaded" ||
    month.selectedMonthKey !== monthKey
  ) {
    return "unavailable";
  }

  return month.hasSavedPeriod ? "persisted" : "not-persisted";
}
