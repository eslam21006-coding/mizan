import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const branchFiles = {
  uploader: join(
    repoRoot,
    "src/app/(app)/businesses/[businessId]/customers/import/transaction-preview-uploader.tsx",
  ),
  page: join(repoRoot, "src/app/(app)/businesses/[businessId]/customers/import/page.tsx"),
  parser: join(repoRoot, "src/lib/business/transaction-preview.ts"),
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

  const sizeGuardIndex = uploader.indexOf(
    "file.size > TRANSACTION_PREVIEW_LIMITS.maxFileBytes",
  );
  const fileReadIndex = uploader.indexOf("file.arrayBuffer()");
  assert.ok(sizeGuardIndex >= 0, "Task 17 must check the browser file-size boundary");
  assert.ok(fileReadIndex >= 0, "Task 17 must read accepted files locally");
  assert.ok(
    sizeGuardIndex < fileReadIndex,
    "Task 17 must reject oversized files before materializing them in memory",
  );
});

test("Task 17 does not introduce column mapping semantics", async () => {
  const uploader = await readFile(branchFiles.uploader, "utf8");
  assert.doesNotMatch(uploader, /selectOption|columnMapping|mappedColumn|mappingForm/i);
});
