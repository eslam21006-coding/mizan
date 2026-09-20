import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/page.tsx",
  "utf8",
);
const drawerSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/expense-drawer.tsx",
  "utf8",
);
const actionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/expenses/actions.ts",
  "utf8",
);

test("N28 moves expense create and edit into an accessible native drawer", () => {
  assert.match(pageSource, /ExpenseDrawerLauncher/);
  assert.match(pageSource, /mode="create"/);
  assert.match(pageSource, /mode="edit"/);
  assert.doesNotMatch(pageSource, /className=\{styles\.createForm\}/);
  assert.doesNotMatch(pageSource, /className=\{styles\.editForm\}/);

  assert.match(drawerSource, /<dialog/);
  assert.match(drawerSource, /dialog\.showModal\(\)/);
  assert.match(drawerSource, /method="dialog"/);
  assert.match(drawerSource, /onClose=\{restoreFocus\}/);
  assert.match(drawerSource, /aria-haspopup="dialog"/);
});

test("N29 keeps create and update on existing server actions with structured return context", () => {
  assert.match(drawerSource, /createExpenseItem/);
  assert.match(drawerSource, /updateExpenseItem/);
  assert.match(
    drawerSource,
    /action=\{isCreate \? createExpenseItem : updateExpenseItem\}/,
  );
  assert.match(drawerSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(drawerSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.match(drawerSource, /name="upstream_origin"/);
  assert.match(drawerSource, /name="upstream_month"/);
  assert.match(drawerSource, /name="creation_request_id"/);
  assert.match(drawerSource, /name="expense_id"/);

  assert.match(actionsSource, /formData\.getAll\("origin"\)/);
  assert.match(actionsSource, /formData\.getAll\("month"\)/);
  assert.match(actionsSource, /formData\.getAll\("upstream_origin"\)/);
  assert.match(actionsSource, /formData\.getAll\("upstream_month"\)/);
  assert.match(pageSource, /deleteExpenseItem/);
});
