import {
  isValidTransactionDate,
  isValidTransactionEmail,
  normalizeTransactionEmail,
  parseTransactionAmount,
  type TransactionValidationInputRow,
} from "./transaction-import-validation.ts";

export const TRANSACTION_IMPORT_CHUNK_SIZE = 500;
export const TRANSACTION_IMPORT_SOURCE_MAX_LENGTH = 80;
export const TRANSACTION_ID_MAX_LENGTH = 512;

export type TransactionDuplicateInputRow = TransactionValidationInputRow & {
  transactionId?: string;
};

export type PreparedTransactionImportRow = {
  row_number: number;
  transaction_id: string | null;
  customer_email: string;
  transaction_date: string;
  amount_collected: string;
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

export function normalizeTransactionImportSource(value: string) {
  return value.trim().toLowerCase();
}

export function isValidTransactionImportSource(value: string) {
  const normalized = normalizeTransactionImportSource(value);
  return normalized.length > 0 && normalized.length <= TRANSACTION_IMPORT_SOURCE_MAX_LENGTH;
}

export function normalizeTransactionId(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

export function prepareTransactionImportRows(
  rows: readonly TransactionDuplicateInputRow[],
  options: { skipFirstRow?: boolean } = {},
): PreparedTransactionImportRow[] {
  const prepared: PreparedTransactionImportRow[] = [];
  let firstSourceRowSeen = false;

  for (const row of rows) {
    if (!firstSourceRowSeen) {
      firstSourceRowSeen = true;
      if (options.skipFirstRow) continue;
    }

    const transactionId = normalizeTransactionId(row.transactionId);
    if (transactionId && transactionId.length > TRANSACTION_ID_MAX_LENGTH) {
      throw new TransactionImportPreparationError(
        "TRANSACTION_ID_TOO_LONG",
        row.rowNumber,
        `Transaction ID must be ${TRANSACTION_ID_MAX_LENGTH} characters or fewer.`,
      );
    }

    const email = normalizeTransactionEmail(row.customerEmail);
    const transactionDate = row.transactionDate.trim();
    const amount = parseTransactionAmount(row.amountCollected);
    if (!isValidTransactionEmail(email) || !isValidTransactionDate(transactionDate) || amount === null) {
      throw new TransactionImportPreparationError(
        "ROW_NOT_VALIDATED",
        row.rowNumber,
        "Only validated transaction rows can be prepared for import.",
      );
    }

    prepared.push({
      row_number: row.rowNumber,
      transaction_id: transactionId,
      customer_email: email,
      transaction_date: transactionDate.slice(0, 10),
      amount_collected: row.amountCollected.trim().replaceAll(",", ""),
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
