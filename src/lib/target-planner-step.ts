export const TARGET_PLANNER_STEPS = ["goal", "assumptions", "plan"] as const;

export type TargetPlannerStep = (typeof TARGET_PLANNER_STEPS)[number];

export type TargetPlannerStepHrefState = {
  businessId: string;
  goal: string;
  value?: string;
};

/** Accepts only known Target Planner steps and falls back safely to the goal step. */
export function parseTargetPlannerStep(value: unknown): TargetPlannerStep {
  return typeof value === "string" &&
    TARGET_PLANNER_STEPS.includes(value as TargetPlannerStep)
    ? (value as TargetPlannerStep)
    : "goal";
}

/** Builds a canonical Target Planner step URL from allow-listed workflow state. */
export function buildTargetPlannerStepHref(
  state: TargetPlannerStepHrefState,
  step: TargetPlannerStep,
  basePath = "/target-plan",
) {
  const query = new URLSearchParams({
    business: state.businessId,
    goal: state.goal,
    step,
  });

  if (state.value !== undefined) {
    query.set("value", state.value);
  }

  return `${basePath}?${query.toString()}`;
}
