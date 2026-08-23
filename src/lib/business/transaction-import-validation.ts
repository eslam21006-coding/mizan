export const TRANSACTION_VALIDATION_ERROR_SAMPLE_LIMIT = 25;

export const TRANSACTION_VALIDATION_FIELDS = [
  "customerEmail",
  "transactionDate",
  "amountCollected",
] as const;

export type TransactionValidationField = (typeof TRANSACTION_VALIDATION_FIELDS)[number];

export type TransactionValidationInputRow = {
  rowNumber: number;
  customerEmail: string;
  transactionDate: string;
  amountCollected: string;
};

export type TransactionValidationIssueCode =
  | "EMAIL_REQUIRED"
  | "EMAIL_INVALID"
  | "TRANSACTION_DATE_REQUIRED"
  | "TRANSACTION_DATE_INVALID"
  | "AMOUNT_REQUIRED"
  | "AMOUNT_INVALID";

export type TransactionValidationIssue = {
  rowNumber: number;
  field: TransactionValidationField;
  code: TransactionValidationIssueCode;
  rawValue: string;
};

export type TransactionImportValidationResult = {
  totalSourceRows: number;
  checkedRows: number;
  validRows: number;
  invalidRows: number;
  skippedHeaderRows: number;
  issueCount: number;
  issues: TransactionValidationIssue[];
  issuesTruncated: boolean;
  isValid: boolean;
};

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const DECIMAL_AMOUNT_PATTERN = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

export function normalizeTransactionEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidTransactionEmail(value: string) {
  const normalized = normalizeTransactionEmail(value);
  if (!normalized || !BASIC_EMAIL_PATTERN.test(normalized)) return false;
  const firstAt = normalized.indexOf("@");
  return firstAt > 0 && firstAt === normalized.lastIndexOf("@") && firstAt < normalized.length - 1;
}

export function isValidTransactionDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return false;

  const dateOnly = normalized.match(ISO_DATE_PATTERN);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  return ISO_DATE_TIME_PATTERN.test(normalized) && Number.isFinite(Date.parse(normalized));
}

export function parseTransactionAmount(value: string) {
  const normalized = value.trim();
  if (!normalized || !DECIMAL_AMOUNT_PATTERN.test(normalized)) return null;
  const amount = Number(normalized.replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function rowIssues(row: TransactionValidationInputRow): TransactionValidationIssue[] {
  const issues: TransactionValidationIssue[] = [];
  const email = row.customerEmail.trim();
  const transactionDate = row.transactionDate.trim();
  const amountCollected = row.amountCollected.trim();

  if (!email) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "customerEmail",
      code: "EMAIL_REQUIRED",
      rawValue: row.customerEmail,
    });
  } else if (!isValidTransactionEmail(email)) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "customerEmail",
      code: "EMAIL_INVALID",
      rawValue: row.customerEmail,
    });
  }

  if (!transactionDate) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "transactionDate",
      code: "TRANSACTION_DATE_REQUIRED",
      rawValue: row.transactionDate,
    });
  } else if (!isValidTransactionDate(transactionDate)) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "transactionDate",
      code: "TRANSACTION_DATE_INVALID",
      rawValue: row.transactionDate,
    });
  }

  if (!amountCollected) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "amountCollected",
      code: "AMOUNT_REQUIRED",
      rawValue: row.amountCollected,
    });
  } else if (parseTransactionAmount(amountCollected) === null) {
    issues.push({
      rowNumber: row.rowNumber,
      field: "amountCollected",
      code: "AMOUNT_INVALID",
      rawValue: row.amountCollected,
    });
  }

  return issues;
}

export function validateTransactionImportRows(
  rows: readonly TransactionValidationInputRow[],
  options: { skipFirstRow?: boolean; issueSampleLimit?: number } = {},
): TransactionImportValidationResult {
  const issueSampleLimit = options.issueSampleLimit ?? TRANSACTION_VALIDATION_ERROR_SAMPLE_LIMIT;
  if (!Number.isSafeInteger(issueSampleLimit) || issueSampleLimit < 0) {
    throw new RangeError("Transaction validation issue sample limit must be a non-negative integer.");
  }

  let checkedRows = 0;
  let validRows = 0;
  let invalidRows = 0;
  let skippedHeaderRows = 0;
  let issueCount = 0;
  const issues: TransactionValidationIssue[] = [];

  for (const row of rows) {
    if (!Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1) {
      throw new RangeError("Transaction validation row numbers must be positive integers.");
    }

    if (options.skipFirstRow && row.rowNumber === 1) {
      skippedHeaderRows += 1;
      continue;
    }

    checkedRows += 1;
    const currentIssues = rowIssues(row);
    if (currentIssues.length === 0) {
      validRows += 1;
      continue;
    }

    invalidRows += 1;
    issueCount += currentIssues.length;
    for (const issue of currentIssues) {
      if (issues.length < issueSampleLimit) issues.push(issue);
    }
  }

  return {
    totalSourceRows: rows.length,
    checkedRows,
    validRows,
    invalidRows,
    skippedHeaderRows,
    issueCount,
    issues,
    issuesTruncated: issueCount > issues.length,
    isValid: checkedRows > 0 && invalidRows === 0,
  };
}
