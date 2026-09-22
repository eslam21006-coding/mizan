import { parseResourceId } from "./business/revenue-streams.ts";
import type { TargetGoalType } from "./business/target-engine.ts";
import {
  parseReturnOrigin,
  type ReturnOriginSearchParams,
} from "./return-origin.ts";
import type { TargetPlannerStep } from "./target-planner-step.ts";
import { resolveNavigationDestination } from "./navigation-hierarchy.ts";

export const SIMULATOR_TARGET_PLANNER_RETURN_KEYS = [
  "origin",
  "planner_business",
  "planner_step",
  "planner_goal",
  "planner_value",
] as const;

export type SimulatorTargetPlannerReturnContext = {
  origin: "target-planner";
  plannerBusinessId: string;
  step: TargetPlannerStep;
  goal: TargetGoalType;
  value?: string;
};

export type SimulatorHrefState = {
  businessId: string;
  month: string;
  scenarioId?: string;
  status?: string;
  returnContext?: SimulatorTargetPlannerReturnContext | null;
};

type SingleSearchParam =
  | { status: "missing" }
  | { status: "value"; value: string }
  | { status: "ambiguous" };

type SearchParamReader = {
  getAll(name: string): string[];
};

/** Reads one query parameter while rejecting duplicated values as ambiguous context. */
function readSingleSearchParam(
  searchParams: ReturnOriginSearchParams,
  key: string,
): SingleSearchParam {
  if (typeof (searchParams as Partial<SearchParamReader>).getAll === "function") {
    const values = (searchParams as SearchParamReader).getAll(key);
    if (values.length === 0) return { status: "missing" };
    if (values.length === 1) return { status: "value", value: values[0] };
    return { status: "ambiguous" };
  }

  const value = (searchParams as Readonly<Record<string, string | string[] | undefined>>)[key];
  if (value === undefined) return { status: "missing" };
  if (typeof value === "string") return { status: "value", value };
  return { status: "ambiguous" };
}

/** Parses only a complete, allow-listed Target Planner origin for Simulator return navigation. */
export function parseSimulatorTargetPlannerReturnContext(
  searchParams: ReturnOriginSearchParams,
): SimulatorTargetPlannerReturnContext | null {
  const origin = parseReturnOrigin(searchParams);
  if (!origin || origin.origin !== "target-planner") return null;

  const plannerBusinessParam = readSingleSearchParam(searchParams, "planner_business");
  if (plannerBusinessParam.status !== "value") return null;

  const plannerBusinessId = parseResourceId(plannerBusinessParam.value);
  if (!plannerBusinessId) return null;

  return {
    origin: "target-planner",
    plannerBusinessId,
    step: origin.step,
    goal: origin.goal,
    ...(origin.value !== undefined ? { value: origin.value } : {}),
  };
}

/** Builds a canonical Simulator URL while preserving only validated structured return context. */
export function buildSimulatorHref(
  state: SimulatorHrefState,
  basePath = "/simulator",
) {
  const query = new URLSearchParams({
    business: state.businessId,
    month: state.month,
  });

  if (state.scenarioId) query.set("scenario", state.scenarioId);
  if (state.status) query.set("status", state.status);

  const context = state.returnContext;
  if (context) {
    query.set("origin", "target-planner");
    query.set("planner_business", context.plannerBusinessId);
    query.set("planner_step", context.step);
    query.set("planner_goal", context.goal);
    if (context.value !== undefined) {
      query.set("planner_value", context.value);
    }
  }

  return `${basePath}?${query.toString()}`;
}

/** Resolves the deterministic Target Planner destination represented by Simulator return context. */
export function buildTargetPlannerReturnHref(
  context: SimulatorTargetPlannerReturnContext,
) {
  return resolveNavigationDestination({
    route: "target-planner",
    businessId: context.plannerBusinessId,
    step: context.step,
    goal: context.goal,
    value: context.value,
  });
}
