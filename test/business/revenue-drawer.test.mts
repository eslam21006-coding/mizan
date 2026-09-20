import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/page.tsx",
  "utf8",
);
const drawerSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/revenue-stream-drawer.tsx",
  "utf8",
);
const actionsSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/revenue-streams/actions.ts",
  "utf8",
);

test("N30 moves Revenue Source create/edit into an accessible native drawer", () => {
  assert.match(pageSource, /RevenueStreamDrawerLauncher/);
  assert.match(pageSource, /mode="create"/);
  assert.match(pageSource, /mode="edit"/);
  assert.doesNotMatch(pageSource, /className=\{styles\.createForm\}/);
  assert.doesNotMatch(pageSource, /className=\{styles\.editForm\}/);

  assert.match(drawerSource, /<dialog/);
  assert.match(drawerSource, /dialog\.showModal\(\)/);
  assert.match(drawerSource, /method="dialog"/);
  assert.match(drawerSource, /const formRef = useRef<HTMLFormElement>\(null\)/);
  assert.match(drawerSource, /formRef\.current\?\.reset\(\)/);
  assert.match(drawerSource, /onClose=\{handleClose\}/);
  assert.match(drawerSource, /ref=\{formRef\}/);
  assert.match(drawerSource, /aria-haspopup="dialog"/);
});

test("N31 keeps create/update on existing server actions with structured return context", () => {
  assert.match(drawerSource, /createRevenueStream/);
  assert.match(drawerSource, /updateRevenueStream/);
  assert.match(
    drawerSource,
    /action=\{isCreate \? createRevenueStream : updateRevenueStream\}/,
  );
  assert.match(drawerSource, /name="origin" value=\{returnOrigin\.origin\}/);
  assert.match(drawerSource, /name="month" value=\{returnOrigin\.month\}/);
  assert.match(drawerSource, /name="upstream_origin"/);
  assert.match(drawerSource, /name="upstream_month"/);
  assert.match(drawerSource, /name="creation_request_id"/);
  assert.match(drawerSource, /name="stream_id"/);

  assert.match(actionsSource, /formData\.getAll\("origin"\)/);
  assert.match(actionsSource, /formData\.getAll\("month"\)/);
  assert.match(actionsSource, /formData\.getAll\("upstream_origin"\)/);
  assert.match(actionsSource, /formData\.getAll\("upstream_month"\)/);
  assert.match(pageSource, /deleteRevenueStream/);
});
