import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewGuideSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-review-guide.tsx",
  "utf8",
);
const uploaderSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-preview-uploader.tsx",
  "utf8",
);
const validatorSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-validator.tsx",
  "utf8",
);
const customersPageSource = readFileSync("src/app/(app)/customers/page.tsx", "utf8");
const completionCardSource = readFileSync(
  "src/app/(app)/businesses/[businessId]/customers/import/transaction-import-completion-card.tsx",
  "utf8",
);

test("review guidance distinguishes validation from persistence and keeps invalid imports fail-closed", () => {
  assert.match(reviewGuideSource, /المراجعة وحدها لا تحفظ أي معاملات/);
  assert.match(reviewGuideSource, /إذا كان عدد الصفوف غير الصالحة أكبر من صفر، يتوقف الحفظ بالكامل/);
  assert.match(reviewGuideSource, /لا يستورد الصفوف الصالحة وحدها ولا يتجاهل الأخطاء\s+تلقائيًا/);
  assert.match(reviewGuideSource, /هذا هو الإجراء الذي يحفظ المعاملات فعلًا/);
  assert.match(reviewGuideSource, /href="#transaction-file"/);
  assert.match(reviewGuideSource, /href="#transaction-validation-title"/);

  assert.match(
    validatorSource,
    /setValidatedRows\(validationResult\.isValid \? rows : null\)/,
    "invalid validation must continue to block the entire import rather than partially saving rows",
  );
});

test("the upload workflow places the clarity guide after review and names review then save as separate actions", () => {
  assert.match(uploaderSource, /"مراجعة ثم حفظ"/);
  assert.match(uploaderSource, /<TransactionImportReviewGuide \/>/);
  assert.ok(
    uploaderSource.indexOf("<TransactionImportReviewGuide />") >
      uploaderSource.indexOf("<TransactionColumnMapper"),
    "the next-step guide should appear after the mapper and validator workflow",
  );
});

test("customer navigation describes automatic grouping and uses an analysis action instead of manual grouping", () => {
  assert.match(customersPageSource, /تجميع معاملات العميل يتم تلقائيًا داخل ميزان/);
  assert.match(customersPageSource, />\s*عرض تحليل العملاء\s*<\/Link>/);
  assert.doesNotMatch(customersPageSource, />\s*تجميع العملاء\s*<\/Link>/);
  assert.match(completionCardSource, />\s*عرض تحليل العملاء\s*<\/a>/);
});
