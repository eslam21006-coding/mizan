import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveFirstMonthSaveRecovery } from "../../src/lib/business/first-month-save-recovery.ts";
import { isUncertainMonthlyWriteFailure } from "../../src/lib/business/monthly-write-outcome.ts";

const businessId = "00000000-0000-4000-8000-000000000152";
const monthKey = "2026-10";

test("B12B.2 classifies only transport-loss RPC results as uncertain", () => {
  assert.equal(isUncertainMonthlyWriteFailure({ status: 0, code: "" }), true);
  assert.equal(isUncertainMonthlyWriteFailure({ status: 400, code: "22023" }), false);
  assert.equal(isUncertainMonthlyWriteFailure({ status: 500, code: "P0001" }), false);
});

test("B12B.2 uncertain recovery reports only independently re-read persisted state", () => {
  const setup = { kind: "loaded" as const, business: { id: businessId } };

  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, setup, {
      kind: "loaded",
      selectedMonthKey: monthKey,
      hasSavedPeriod: true,
    }),
    "persisted",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, setup, {
      kind: "loaded",
      selectedMonthKey: monthKey,
      hasSavedPeriod: false,
    }),
    "not-persisted",
  );
});

test("B12B.2 uncertain recovery fails closed for wrong identity or unreadable state", () => {
  const exactSetup = { kind: "loaded" as const, business: { id: businessId } };
  const exactMonth = {
    kind: "loaded" as const,
    selectedMonthKey: monthKey,
    hasSavedPeriod: true,
  };

  assert.equal(
    resolveFirstMonthSaveRecovery(
      businessId,
      monthKey,
      { kind: "loaded", business: { id: "foreign" } },
      exactMonth,
    ),
    "unavailable",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, { kind: "not_found" }, exactMonth),
    "unavailable",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(
      businessId,
      monthKey,
      { kind: "load_error", business: { id: businessId } },
      exactMonth,
    ),
    "unavailable",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, exactSetup, {
      ...exactMonth,
      selectedMonthKey: "2026-09",
    }),
    "unavailable",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, exactSetup, {
      kind: "load_error",
      selectedMonthKey: monthKey,
    }),
    "unavailable",
  );
  assert.equal(
    resolveFirstMonthSaveRecovery(businessId, monthKey, exactSetup, null),
    "unavailable",
  );
});

test("B12B.2 setup action separates confirmed failures from thrown unknown outcomes", async () => {
  const action = await readFile(
    new URL(
      "../../src/app/(app)/businesses/[businessId]/setup/first-month-actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  const write = action.indexOf("await persistMonthlyActuals(formData, {");
  const uncertainOption = action.indexOf("recoverUncertainWrite: true", write);
  const writeCatch = action.indexOf("} catch (error) {", uncertainOption);
  const rethrow = action.indexOf("unstable_rethrow(error)", writeCatch);
  const thrownRecovery = action.indexOf("return recoverUnknownSave(previous, formData)", rethrow);
  const confirmed = action.indexOf("if (!result.ok)", thrownRecovery);
  const structuredUnknown = action.indexOf('result.code === "save-uncertain"', confirmed);
  const structuredRecovery = action.indexOf(
    "return recoverUnknownSave(previous, formData)",
    structuredUnknown,
  );

  assert.ok(
    write >= 0 &&
      uncertainOption > write &&
      writeCatch > uncertainOption &&
      rethrow > writeCatch &&
      thrownRecovery > rethrow &&
      confirmed > thrownRecovery &&
      structuredUnknown > confirmed &&
      structuredRecovery > structuredUnknown,
    "Thrown and status-zero persistence outcomes must recover truthfully; structured confirmed failures stay separate.",
  );
  assert.match(action, /loadBusinessSetup\(identity\.businessId\)/);
  assert.match(action, /loadFirstMonthSetup\(\s*identity\.businessId,\s*identity\.monthKey,/);
  assert.match(action, /code: "save-uncertain"/);
  assert.match(action, /draft: preserveDraft\(formData\)/);
  assert.match(action, /recovery: null/);
});

test("B12B.2 shared Monthly save preserves ordinary behavior while exposing Setup-only uncertainty", async () => {
  const service = await readFile(
    new URL("../../src/lib/business/monthly-save-service.ts", import.meta.url),
    "utf8",
  );

  assert.match(service, /const \{ error, status \} = await supabase\.rpc\("save_monthly_actuals"/);
  assert.match(service, /options\.recoverUncertainWrite/);
  assert.match(service, /isUncertainMonthlyWriteFailure\(\{ status, code: error\.code \}\)/);
  assert.match(service, /return fail\("save-uncertain"\)/);
  assert.match(service, /return fail\("save-failed"\)/);
});

test("B12B.2 recovery copy does not claim the latest uncertain attempt succeeded", async () => {
  const form = await readFile(
    new URL(
      "../../src/app/(app)/businesses/[businessId]/setup/first-month-save-form.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(form, /قد تكون من حفظ سابق أو من المحاولة الأخيرة/);
  assert.match(form, /لم نجد شهرًا محفوظًا حاليًا/);
  assert.match(form, /لم يفترض ميزان نجاح الحفظ أو فشله/);
  assert.match(form, /القيم الظاهرة أدناه هي آخر ما أرسلته وليست تأكيدًا لما تم حفظه/);
});

test("B12B.2 stable submit control disables and announces the in-flight action", async () => {
  const button = await readFile(
    new URL("../../src/components/stable-submit-button.tsx", import.meta.url),
    "utf8",
  );

  assert.match(button, /const \{ pending \} = useFormStatus\(\)/);
  assert.match(button, /const isDisabled = disabled \|\| pending/);
  assert.match(button, /disabled=\{isDisabled\}/);
  assert.match(button, /aria-busy=\{pending \|\| undefined\}/);
  assert.match(button, /role="status"/);
  assert.match(button, /aria-atomic="true"/);
});
