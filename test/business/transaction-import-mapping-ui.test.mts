import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uploader = await readFile(
  new URL(
    "../../src/app/(app)/businesses/[businessId]/customers/import/transaction-preview-uploader.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("each successful file selection remounts the transaction mapper even when metadata repeats", () => {
  assert.match(uploader, /const \[fileSelectionId, setFileSelectionId\] = useState\(0\)/);
  assert.match(uploader, /setFileSelectionId\(\(current\) => current \+ 1\)/);
  assert.match(
    uploader,
    /key=\{`\$\{fileSelectionId\}:\$\{preview\.fileName\}:\$\{preview\.fileSize\}:\$\{preview\.totalRows\}:\$\{preview\.totalColumns\}`\}/,
  );
});
