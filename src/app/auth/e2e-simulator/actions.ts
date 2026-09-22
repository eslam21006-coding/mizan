"use server";

import { redirect } from "next/navigation";
import {
  buildSimulatorHref,
  parseSimulatorTargetPlannerReturnContextFromFormData,
} from "@/lib/simulator-return-context";

const FIXTURE_BUSINESS_ID = "00000000-0000-4000-8000-000000000034";
const FIXTURE_PATH = "/auth/e2e-simulator";

/** Redirects a CI-only Simulator mutation through the production return-context parser and URL builder. */
function redirectFixtureMutation(
  formData: FormData,
  status: "updated" | "duplicated" | "deleted",
  scenarioId?: "a" | "b",
): never {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    redirect("/");
  }

  const returnContext = parseSimulatorTargetPlannerReturnContextFromFormData(formData);
  redirect(
    buildSimulatorHref(
      {
        businessId: FIXTURE_BUSINESS_ID,
        month: "2026-08",
        scenarioId,
        status,
        returnContext,
      },
      FIXTURE_PATH,
    ),
  );
}

/** CI-only save mutation that exercises the shared structured return-context redirect path. */
export async function saveSimulatorFixtureScenario(formData: FormData) {
  redirectFixtureMutation(formData, "updated", "a");
}

/** CI-only duplicate mutation that exercises the shared structured return-context redirect path. */
export async function duplicateSimulatorFixtureScenario(formData: FormData) {
  redirectFixtureMutation(formData, "duplicated", "b");
}

/** CI-only delete mutation that exercises the shared structured return-context redirect path. */
export async function deleteSimulatorFixtureScenario(formData: FormData) {
  redirectFixtureMutation(formData, "deleted");
}
