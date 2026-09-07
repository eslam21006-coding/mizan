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

test("review guidance distinguishes validation from persistence and explicitly skips only invalid rows", () => {
  assert.match(reviewGuideSource, /المراجعة وحدها لا تحفظ أي معاملات/);
  assert.match(reviewGuideSource, /وجود صفوف غير صالحة لا يوقف باقي الملف/);
  assert.match(reviewGuideSource, /يستورد\s+الصفوف السليمة فقط/);
  assert.match(reviewGuideSource, /لا يخمن مبلغًا\s+مفقودًا ولا يحول عملة مختلفة/);
  assert.match(reviewGuideSource, /هذا هو الإجراء الذي يحفظ المعاملات فعلًا/);
  assert.match(reviewGuideSource, /href="#transaction-file"/);
  assert.match(reviewGuideSource, /href="#transaction-validation-title"/);

  assert.match(
    validatorSource,
    /validationResult\.importableRows\.length > 0 \? validationResult\.importableRows : null/,
    "only rows that passed the complete validator may reach transaction preparation",
  );
  assert.match(
    validatorSource,
    /skipFirstRow: false/,
    "validated importable rows must not lose the first real transaction by applying header removal twice",
  );
  assert.match(validatorSource, /الصفوف غير الصالحة لم تُحفظ|الصفوف المتجاهلة لن تُحفظ/);
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
  assert.match(completionCardSource, /صفوف غير صالحة تم تجاهلها/);
});
