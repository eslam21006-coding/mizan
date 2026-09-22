import { parseResourceId } from "./business/revenue-streams.ts";

export type SimulatorScenarioSummary = {
  id: string;
  name: string;
};

export type SimulatorScenarioState =
  | { kind: "new" }
  | { kind: "saved"; scenario: SimulatorScenarioSummary }
  | { kind: "unavailable" };

/** Resolves URL-backed scenario identity without silently converting stale or malformed state into a new scenario. */
export function resolveSimulatorScenarioState(
  requestedScenario: unknown,
  scenarios: readonly SimulatorScenarioSummary[],
): SimulatorScenarioState {
  if (requestedScenario === undefined || requestedScenario === "") {
    return { kind: "new" };
  }

  if (typeof requestedScenario !== "string") {
    return { kind: "unavailable" };
  }

  const scenarioId = parseResourceId(requestedScenario);
  if (!scenarioId) {
    return { kind: "unavailable" };
  }

  const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
  return scenario ? { kind: "saved", scenario } : { kind: "unavailable" };
}

/** Returns a scenario ID only when a valid saved scenario may safely persist into another Simulator URL state. */
export function persistentSimulatorScenarioId(state: SimulatorScenarioState) {
  return state.kind === "saved" ? state.scenario.id : undefined;
}
