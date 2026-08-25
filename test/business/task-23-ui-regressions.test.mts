import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customerOverview = readFileSync("src/app/(app)/customers/page.tsx", "utf8");
const businessCardsCss = readFileSync("src/app/(app)/businesses/businesses.module.css", "utf8");
const playwrightConfig = readFileSync("playwright.config.ts", "utf8");
const globalSetup = readFileSync("e2e/global-setup.ts", "utf8");
const globalTeardown = readFileSync("e2e/global-teardown.ts", "utf8");

test("Tasks 22-23 customer overview describes current cohort and Observed LTV capability", () => {
  assert.match(customerOverview, /Observed LTV \/ قيمة العميل المحققة حتى الآن/);
  assert.doesNotMatch(customerOverview, /تبدأ في المهام التالية/);
});

test("business and customer cards stack guidance above actions instead of squeezing text", () => {
  assert.match(businessCardsCss, /\.nextStep\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(businessCardsCss, /\.manageLinks\s*\{[\s\S]*?width:\s*100%;/);
  assert.doesNotMatch(
    businessCardsCss,
    /\.manageLinks\s*\{[\s\S]*?flex:\s*0\s+0\s+auto;/,
  );
});

test("authenticated E2E requires an isolated account and cleans businesses created by the suite", () => {
  assert.match(playwrightConfig, /globalSetup:\s*"\.\/e2e\/global-setup\.ts"/);
  assert.match(playwrightConfig, /globalTeardown:\s*"\.\/e2e\/global-teardown\.ts"/);
  assert.match(globalSetup, /MIZAN_E2E_DEDICATED_ACCOUNT/);
  assert.match(globalSetup, /baselineBusinessIds/);
  assert.match(globalTeardown, /createdBusinessIds/);
  assert.match(globalTeardown, /customer_transactions/);
  assert.match(globalTeardown, /funnel_monthly_periods/);
  assert.match(globalTeardown, /\.from\("businesses"\)\s*\.delete\(\)/);
  assert.match(globalTeardown, /leftovers/);
});
