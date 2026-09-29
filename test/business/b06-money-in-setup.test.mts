import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const setupLoaderSource = await readFile(
  new URL("../../src/lib/business/setup-loader.ts", import.meta.url),
  "utf8",
);

test("B06-A setup loader returns revenue rows while readiness still counts active sources only", () => {
  assert.match(setupLoaderSource, /\.select\("id,name,stream_type,is_active"\)/);
  assert.doesNotMatch(setupLoaderSource, /\.eq\("is_active", true\)/);
  assert.match(
    setupLoaderSource,
    /const revenueSourceCount = revenueSources\.filter\(\(stream\) => stream\.isActive\)\.length/,
  );
  assert.match(setupLoaderSource, /revenueSources,/);
  assert.match(setupLoaderSource, /revenueSourceCount,/);
});

test("B06-A setup loading remains read-only", () => {
  assert.doesNotMatch(setupLoaderSource, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});
