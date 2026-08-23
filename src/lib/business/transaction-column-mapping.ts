import { transactionColumnLabel } from "./transaction-columns.ts";

export const REQUIRED_TRANSACTION_FIELDS = [
  "customerEmail",
  "transactionDate",
  "amountCollected",
] as const;

export const TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT = 256;

export type RequiredTransactionField = (typeof REQUIRED_TRANSACTION_FIELDS)[number];

export type TransactionColumnMapping = Record<RequiredTransactionField, number | null>;

export const EMPTY_TRANSACTION_COLUMN_MAPPING: TransactionColumnMapping = {
  customerEmail: null,
  transactionDate: null,
  amountCollected: null,
};

export const TRANSACTION_FIELD_LABELS: Record<RequiredTransactionField, string> = {
  customerEmail: "Customer Email",
  transactionDate: "Transaction Date",
  amountCollected: "Amount Collected",
};

export type TransactionColumnMappingState = {
  mapping: TransactionColumnMapping;
  isComplete: boolean;
  hasDuplicateColumns: boolean;
  missingFields: RequiredTransactionField[];
};

export type TransactionColumnChoice = {
  column: number;
  label: string;
  sample: string;
};

export function buildTransactionColumnChoices(input: {
  totalColumns: number;
  previewRows: readonly (readonly string[])[];
  sampleColumnLimit: number;
}): TransactionColumnChoice[] {
  if (!Number.isSafeInteger(input.totalColumns) || input.totalColumns < 0) {
    throw new RangeError("Total transaction columns must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(input.sampleColumnLimit) || input.sampleColumnLimit < 0) {
    throw new RangeError("Transaction sample column limit must be a non-negative integer.");
  }

  const choiceCount = Math.min(input.totalColumns, TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT);
  return Array.from({ length: choiceCount }, (_, column) => {
    let sample = "";
    if (column < input.sampleColumnLimit) {
      for (const row of input.previewRows) {
        const value = row[column]?.trim();
        if (value) {
          sample = value;
          break;
        }
      }
    }

    return {
      column,
      label: transactionColumnLabel(column),
      sample,
    };
  });
}

export function inspectTransactionColumnMapping(
  mapping: TransactionColumnMapping,
): TransactionColumnMappingState {
  const missingFields = REQUIRED_TRANSACTION_FIELDS.filter((field) => mapping[field] === null);
  const selectedColumns = REQUIRED_TRANSACTION_FIELDS.flatMap((field) => {
    const column = mapping[field];
    return column === null ? [] : [column];
  });
  const hasDuplicateColumns = new Set(selectedColumns).size !== selectedColumns.length;

  return {
    mapping,
    isComplete: missingFields.length === 0 && !hasDuplicateColumns,
    hasDuplicateColumns,
    missingFields,
  };
}

export function setTransactionFieldColumn(
  mapping: TransactionColumnMapping,
  field: RequiredTransactionField,
  column: number | null,
): TransactionColumnMapping {
  if (column !== null && (!Number.isSafeInteger(column) || column < 0)) {
    throw new RangeError("Transaction mapping column must be a non-negative integer or null.");
  }

  return { ...mapping, [field]: column };
}
