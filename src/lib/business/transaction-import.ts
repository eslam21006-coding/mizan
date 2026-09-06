import {
  isValidTransactionDate,
  isValidTransactionEmail,
  normalizeGatewayTransactionRows,
  normalizeTransactionDateForImport,
  normalizeTransactionEmail,
  parseTransactionAmount,
  TRANSACTION_ID_MAX_LENGTH,
  type TransactionValidationInputRow,
} from "./transaction-import-validation.ts";

export const TRANSACTION_IMPORT_CHUNK_SIZE = 500;
export const TRANSACTION_IMPORT_SOURCE_MAX_LENGTH = 80;
export const TRANSACTION_IMPORT_TYPES = ["collection", "refund"] as const;

export type CandidateDuplicateResolution = "duplicate" | "keep_distinct";
export type NormalizedTransactionType = (typeof TRANSACTION_IMPORT_TYPES)[number];

export type TransactionDuplicateInputRow = TransactionValidationInputRow;

export type PreparedTransactionImportRow = {
  row_number: number;
  transaction_id: string | null;
  import_row_token: string;
  customer_email: string;
  transaction_date: string;
  amount_collected: string;
  transaction_type: NormalizedTransactionType;
  normalized_outcome: "successful";
  currency: string;
  candidate_resolution?: CandidateDuplicateResolution;
  candidate_resolution_id?: string;
};

export type TransactionImportPreparationErrorCode = "TRANSACTION_ID_TOO_LONG" | "ROW_NOT_VALIDATED";

export class TransactionImportPreparationError extends Error {
  readonly code: TransactionImportPreparationErrorCode;
  readonly rowNumber: number;

  constructor(code: TransactionImportPreparationErrorCode, rowNumber: number, message: string) {
    super(message);
    this.name = "TransactionImportPreparationError";
    this.code = code;
    this.rowNumber = rowNumber;
  }
}

function trimPostgresBtrimSpace(value: string) {
  return value.replace(/^ +| +$/g, "");
}

export function normalizeTransactionImportSource(value: string) {
  return trimPostgresBtrimSpace(value).toLowerCase();
}

export function isValidTransactionImportSource(value: string) {
  const normalized = normalizeTransactionImportSource(value);
  const characterLength = Array.from(normalized).length;
  return characterLength > 0 && characterLength <= TRANSACTION_IMPORT_SOURCE_MAX_LENGTH;
}

export function normalizeTransactionId(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizedAmountText(value: string, transactionType: NormalizedTransactionType) {
  const normalized = value.trim().replaceAll(",", "");
  if (transactionType === "refund") return normalized.replace(/^[+-]/, "");
  return normalized.replace(/^\+/, "");
}

function exactDecimalSign(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  const unsigned = normalized.replace(/^[+-]/, "");
  const coefficient = unsigned.split(/[eE]/, 1)[0] ?? "";
  if (!/[1-9]/.test(coefficient)) return 0;
  return normalized.startsWith("-") ? -1 : 1;
}

export function prepareTransactionImportRows(
  rows: readonly TransactionDuplicateInputRow[],
  options: {
    skipFirstRow?: boolean;
    transactionType: NormalizedTransactionType;
    baseCurrency: string;
    createImportRowToken: () => string;
  },
): PreparedTransactionImportRow[] {
  const prepared: PreparedTransactionImportRow[] = [];
  const baseCurrency = options.baseCurrency.trim().toUpperCase();
  if (!baseCurrency) throw new RangeError("Transaction import base currency is required.");
  const normalized = normalizeGatewayTransactionRows(rows, {
    skipFirstRow: options.skipFirstRow,
  });

  for (const row of normalized.rows) {
    const transactionId = normalizeTransactionId(row.transactionId);
    if (transactionId && Array.from(transactionId).length > TRANSACTION_ID_MAX_LENGTH) {
      throw new TransactionImportPreparationError(
        "TRANSACTION_ID_TOO_LONG",
        row.rowNumber,
        `Transaction ID must be ${TRANSACTION_ID_MAX_LENGTH} characters or fewer.`,
      );
    }

    const email = normalizeTransactionEmail(row.customerEmail);
    const transactionDate = normalizeTransactionDateForImport(row.transactionDate);
    const amount = parseTransactionAmount(row.amountCollected);
    const amountSign = exactDecimalSign(row.amountCollected);
    const amountHasValidSign =
      amount !== null &&
      amountSign !== 0 &&
      (options.transactionType === "refund" || amountSign > 0);
    const rowCurrency = row.currency?.trim().toUpperCase();
    if (
      !isValidTransactionEmail(email) ||
      transactionDate === null ||
      !isValidTransactionDate(transactionDate) ||
      !amountHasValidSign ||
      (rowCurrency !== undefined && rowCurrency !== baseCurrency)
    ) {
      throw new TransactionImportPreparationError(
        "ROW_NOT_VALIDATED",
        row.rowNumber,
        "Only validated successful transactions in the business base currency can be prepared for import.",
      );
    }

    const importRowToken = options.createImportRowToken();
    if (!importRowToken) {
      throw new TransactionImportPreparationError(
        "ROW_NOT_VALIDATED",
        row.rowNumber,
        "Every prepared transaction row requires a stable retry token.",
      );
    }

    prepared.push({
      row_number: row.rowNumber,
      transaction_id: transactionId,
      import_row_token: importRowToken,
      customer_email: email,
      transaction_date: transactionDate,
      amount_collected: normalizedAmountText(row.amountCollected, options.transactionType),
      transaction_type: options.transactionType,
      normalized_outcome: "successful",
      currency: baseCurrency,
    });
  }

  return prepared;
}

export function transactionImportChunks<T>(
  rows: readonly T[],
  chunkSize = TRANSACTION_IMPORT_CHUNK_SIZE,
) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError("Transaction import chunk size must be a positive integer.");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}
