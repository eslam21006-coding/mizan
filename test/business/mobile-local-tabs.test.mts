import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const customerTabs = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-analysis-tabs.tsx",
  "utf8",
);
const customerStyles = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/customer-groups.module.css",
  "utf8",
);
const analyticsStyles = readFileSync(
  "src/app/(app)/analytics/analytics-view-tabs.module.css",
  "utf8",
);

test("N64 keeps Customer local tabs horizontally usable and sticky on mobile", () => {
  assert.match(customerTabs, /tabListRef/);
  assert.match(customerTabs, /scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\)/);
  assert.match(customerStyles, /@media \(max-width: 560px\)[\s\S]*\.analysisTabs \{[\s\S]*position: sticky/);
  assert.match(customerStyles, /overflow-x: auto/);
  assert.match(customerStyles, /scroll-snap-type: x proximity/);
  assert.match(customerStyles, /flex: 0 0 min\(68vw, 210px\)/);
});

test("N64 keeps Analytics local tabs side-by-side on mobile", () => {
  assert.match(
    analyticsStyles,
    /@media \(max-width: 560px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(150px, 1fr\)\)/,
  );
  assert.match(analyticsStyles, /overflow-x: auto/);
  assert.match(analyticsStyles, /scroll-snap-align: start/);
});
