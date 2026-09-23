import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  {
    path: "src/app/(app)/monthly/page.tsx",
    required: ["currentMonthKeyForTimeZone", "/businesses/${business.id}/monthly", "التحليلات"],
  },
  {
    path: "src/app/(app)/target-plan/page.tsx",
    required: [
      "planTarget",
      "resolveRolling3TargetAssumptions",
      "buildTargetPlannerActualMonth",
      "Maximum Sustainable Acquisition CAC",
    ],
  },
  {
    path: "src/app/(app)/settings/page.tsx",
    required: ["SettingsBusinessSelector", "businesses", "base_currency", "timezone"],
  },
  {
    path: "src/app/(app)/businesses/[businessId]/settings/page.tsx",
    required: [
      "BusinessSettingsPageContent",
      "owner_user_id",
      "ownerUserId: business.owner_user_id",
      "viewer={{ userId: auth.userId, role: auth.role }}",
    ],
  },
] as const;

test("sidebar destinations are implemented workflows, not EmptyModule placeholders", async () => {
  for (const route of routes) {
    const source = await readFile(route.path, "utf8");
    assert.doesNotMatch(source, /EmptyModule/, `${route.path} must not regress to EmptyModule`);
    assert.doesNotMatch(
      source,
      /هذه المساحة جاهزة داخل هيكل التطبيق/,
      `${route.path} must not render the legacy placeholder message`,
    );
    for (const required of route.required) {
      assert.ok(source.includes(required), `${route.path} is missing workflow contract: ${required}`);
    }
  }
});
