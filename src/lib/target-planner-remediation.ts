import type { TargetGoalType } from "./business/target-engine.ts";
import type { TargetPlannerActualMonthBlocker } from "./business/target-planner-actuals.ts";
import type { TargetPlannerStep } from "./target-planner-step.ts";

export type TargetPlannerRepairSurface = "monthly" | "funnel-monthly";

export type TargetPlannerRepairContext = {
  businessId: string;
  month: string;
  step: TargetPlannerStep;
  goal: TargetGoalType;
  value?: string;
};

const MONTHLY_BLOCKERS = new Set<TargetPlannerActualMonthBlocker>([
  "CORE_METRIC_UNAVAILABLE",
  "EXPENSE_AMOUNT_UNAVAILABLE",
  "MEDIA_EXCEEDS_FIXED_ACQUISITION",
]);

/** Routes each deterministic Target Planner blocker to the source module that owns its fix. */
export function targetPlannerRepairSurfaceForBlocker(
  blocker: TargetPlannerActualMonthBlocker,
): TargetPlannerRepairSurface {
  return MONTHLY_BLOCKERS.has(blocker) ? "monthly" : "funnel-monthly";
}

/** Builds an exact repair URL carrying only validated structured Target Planner return metadata. */
export function buildTargetPlannerRepairHref(
  context: TargetPlannerRepairContext,
  surface: TargetPlannerRepairSurface,
) {
  const query = new URLSearchParams({
    month: context.month,
    origin: "target-planner",
    planner_step: context.step,
    planner_goal: context.goal,
  });
  if (context.value !== undefined) query.set("planner_value", context.value);

  const businessPath = `/businesses/${encodeURIComponent(context.businessId)}`;
  const pathname =
    surface === "funnel-monthly"
      ? `${businessPath}/funnels/monthly`
      : `${businessPath}/monthly`;

  return `${pathname}?${query.toString()}`;
}
