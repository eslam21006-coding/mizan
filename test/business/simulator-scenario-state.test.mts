import assert from "node:assert/strict";
import test from "node:test";
import {
  persistentSimulatorScenarioId,
  resolveSimulatorScenarioState,
} from "../../src/lib/simulator-scenario-state.ts";

const SCENARIO_A = {
  id: "123e4567-e89b-42d3-a456-426614174101",
  name: "سيناريو أ",
};
const SCENARIO_B = {
  id: "123e4567-e89b-42d3-a456-426614174102",
  name: "سيناريو ب",
};
const SCENARIOS = [SCENARIO_A, SCENARIO_B] as const;

test("treats missing or explicit empty scenario query as new unsaved state", () => {
  assert.deepEqual(resolveSimulatorScenarioState(undefined, SCENARIOS), { kind: "new" });
  assert.deepEqual(resolveSimulatorScenarioState("", SCENARIOS), { kind: "new" });
});

test("resolves only a saved scenario that belongs to the current business scenario list", () => {
  const state = resolveSimulatorScenarioState(SCENARIO_A.id.toUpperCase(), SCENARIOS);
  assert.deepEqual(state, { kind: "saved", scenario: SCENARIO_A });
  assert.equal(persistentSimulatorScenarioId(state), SCENARIO_A.id);
});

test("fails closed for malformed, duplicated, or stale scenario URL state", () => {
  assert.deepEqual(resolveSimulatorScenarioState("not-a-scenario", SCENARIOS), {
    kind: "unavailable",
  });
  assert.deepEqual(resolveSimulatorScenarioState([SCENARIO_A.id, SCENARIO_B.id], SCENARIOS), {
    kind: "unavailable",
  });
  assert.deepEqual(
    resolveSimulatorScenarioState("123e4567-e89b-42d3-a456-426614174199", SCENARIOS),
    { kind: "unavailable" },
  );
  assert.equal(
    persistentSimulatorScenarioId(
      resolveSimulatorScenarioState("123e4567-e89b-42d3-a456-426614174199", SCENARIOS),
    ),
    undefined,
  );
});

test("new scenario state is never persisted implicitly into another URL state", () => {
  assert.equal(
    persistentSimulatorScenarioId(resolveSimulatorScenarioState(undefined, SCENARIOS)),
    undefined,
  );
});
