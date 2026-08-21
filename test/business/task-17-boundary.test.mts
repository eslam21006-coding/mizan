import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const branchFiles = {
  uploader: "src/app/(app)/businesses/[businessId]/customers/import/transaction-preview-uploader.tsx",
  page: "src/app/(app)/businesses/[businessId]/customers/import/page.tsx",
  parser: "src/lib/business/transaction-preview.ts",
};

test("Task 17 remains preview-only with no persistence or transaction import action", async () => {
  const [uploader, page, parser] = await Promise.all([
    readFile(branchFiles.uploader, "utf8"),
    readFile(branchFiles.page, "utf8"),
    readFile(branchFiles.parser, "utf8"),
  ]);

  const combined = `${uploader}\n${page}\n${parser}`;
  assert.doesNotMatch(combined, /\.from\(["']transactions["']\)/);
  assert.doesNotMatch(combined, /supabase\.storage/);
  assert.doesNotMatch(combined, /saveTransaction|importTransaction|persistTransaction/i);
  assert.doesNotMatch(uploader, />\s*استيراد المعاملات\s*</);
  assert.match(uploader, /arrayBuffer\(\)/);
  assert.match(uploader, /لا يتم رفعهما إلى السيرفر/);
});

test("Task 17 does not introduce column mapping semantics", async () => {
  const uploader = await readFile(branchFiles.uploader, "utf8");
  assert.doesNotMatch(uploader, /selectOption|columnMapping|mappedColumn|mappingForm/i);
  assert.match(uploader, /Task 18/);
});
