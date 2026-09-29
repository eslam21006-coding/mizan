import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeBusinessName,
  normalizeTimeZone,
  parseBaseCurrency,
  parseCreationRequestId,
  SUPPORTED_CURRENCIES,
} from "../../src/lib/business/onboarding.ts";

test("Task 5 supports exactly the approved V1 business currencies", () => {
  assert.deepEqual(SUPPORTED_CURRENCIES, ["USD", "AED", "SAR", "EGP", "KWD", "QAR", "JOD", "EUR"]);
});

test("business name normalization trims and collapses whitespace", () => {
  assert.equal(normalizeBusinessName("  أكاديمية   ميزان  "), "أكاديمية ميزان");
  assert.equal(normalizeBusinessName("   "), null);
  assert.equal(normalizeBusinessName("x".repeat(121)), null);
});

test("base currency parsing rejects unsupported values", () => {
  assert.equal(parseBaseCurrency(" egp "), "EGP");
  assert.equal(parseBaseCurrency("GBP"), null);
  assert.equal(parseBaseCurrency(null), null);
});

test("timezone validation accepts named zones but rejects offsets and invented values", () => {
  assert.equal(normalizeTimeZone(" Africa/Cairo "), "Africa/Cairo");
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(normalizeTimeZone("+01:00"), null);
  assert.equal(normalizeTimeZone("Not/ARealTimezone"), null);
  assert.equal(normalizeTimeZone("x".repeat(65)), null);
});

test("creation request IDs accept UUIDs only", () => {
  assert.equal(
    parseCreationRequestId(" 77777777-7777-4777-8777-777777777777 "),
    "77777777-7777-4777-8777-777777777777",
  );
  assert.equal(parseCreationRequestId("not-a-uuid"), null);
  assert.equal(parseCreationRequestId(""), null);
});


const onboardingWizardSource = await readFile(
  new URL("../../src/app/(app)/businesses/new/business-onboarding-wizard.tsx", import.meta.url),
  "utf8",
);

test("B05-A business creation is one form rather than a local micro-wizard", () => {
  assert.doesNotMatch(onboardingWizardSource, /const \[step, setStep\]/);
  assert.doesNotMatch(onboardingWizardSource, /goForward|goBack|راجع البيانات|stepper/);
  assert.match(onboardingWizardSource, /اسم البزنس/);
  assert.match(onboardingWizardSource, /العملة الأساسية/);
  assert.match(onboardingWizardSource, /المنطقة الزمنية/);
  assert.match(onboardingWizardSource, /إنشاء البزنس والمتابعة/);
});


test("B05-B timezone is detected without a silent Cairo fallback and remains editable", () => {
  assert.match(onboardingWizardSource, /const \[timezone, setTimezone\] = useState\("")/);
  assert.match(onboardingWizardSource, /normalizeTimeZone\(detected\)/);
  assert.doesNotMatch(onboardingWizardSource, /useState\("Africa\/Cairo"\)/);
  assert.match(onboardingWizardSource, />تغيير</);
  assert.match(onboardingWizardSource, />تم</);
  assert.match(onboardingWizardSource, /اختر المنطقة الزمنية/);
});


const onboardingActionsSource = await readFile(
  new URL("../../src/app/(app)/businesses/new/actions.ts", import.meta.url),
  "utf8",
);


test("B05-C successful creation and idempotent retry both hand off to B04 setup", () => {
  assert.match(onboardingActionsSource, /buildBusinessSetupHref/);
  assert.match(onboardingActionsSource, /\.insert\([\s\S]*?\.select\("id"\)\.single\(\)/);
  assert.match(onboardingActionsSource, /redirectToCreatedBusinessSetup\(createdBusiness\.id\)/);
  assert.match(onboardingActionsSource, /redirectToCreatedBusinessSetup\(existingBusiness\.id\)/);
  assert.doesNotMatch(onboardingActionsSource, /\/businesses\?status=created/);
  assert.doesNotMatch(onboardingActionsSource, /step=revenue/);
});


test("B05-D creation action does not manufacture later setup data", () => {
  assert.doesNotMatch(onboardingActionsSource, /\.from\("revenue_streams"\)/);
  assert.doesNotMatch(onboardingActionsSource, /\.from\("monthly_periods"\)/);
  assert.doesNotMatch(onboardingActionsSource, /expense_setup_reviewed_at\s*:/);
});
