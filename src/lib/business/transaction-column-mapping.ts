import { transactionColumnLabel } from "./transaction-columns.ts";

export const REQUIRED_TRANSACTION_FIELDS = [
  "customerEmail",
  "transactionDate",
  "amountCollected",
] as const;

export const OPTIONAL_TRANSACTION_FIELDS = ["transactionId", "currency"] as const;
export const TRANSACTION_MAPPING_FIELDS = [
  ...REQUIRED_TRANSACTION_FIELDS,
  ...OPTIONAL_TRANSACTION_FIELDS,
] as const;

export const TRANSACTION_NATIVE_MAPPING_OPTION_LIMIT = 256;

export type RequiredTransactionField = (typeof REQUIRED_TRANSACTION_FIELDS)[number];
export type OptionalTransactionField = (typeof OPTIONAL_TRANSACTION_FIELDS)[number];
export type TransactionMappingField = (typeof TRANSACTION_MAPPING_FIELDS)[number];

export type TransactionColumnMapping = Record<RequiredTransactionField, number | null> & {
  transactionId?: number | null;
  currency?: number | null;
};

export const EMPTY_TRANSACTION_COLUMN_MAPPING: TransactionColumnMapping = {
  customerEmail: null,
  transactionDate: null,
  amountCollected: null,
  transactionId: null,
  currency: null,
};

export const TRANSACTION_FIELD_LABELS: Record<TransactionMappingField, string> = {
  customerEmail: "Customer Email",
  transactionDate: "Transaction Date",
  amountCollected: "Amount Collected",
  transactionId: "Transaction ID",
  currency: "Currency",
};

const TRANSACTION_HEADER_ALIASES: Record<TransactionMappingField, readonly string[]> = {
  customerEmail: [
    "customer email",
    "customer e mail",
    "customer_email",
    "email",
    "email address",
    "customer email address",
  ],
  transactionDate: [
    "transaction date",
    "transaction_date",
    "payment date",
    "paid at",
    "payment time",
    "transaction time",
  ],
  amountCollected: [
    "amount collected",
    "amount_collected",
    "total amount paid",
    "amount paid",
    "total paid",
    "paid amount",
  ],
  transactionId: [
    "transaction id",
    "transaction_id",
    "internal transaction id",
    "payment id",
    "charge id",
    "order id",
  ],
  currency: ["currency", "currency code", "currency_code"],
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

export type TransactionHeaderAutoMapping = {
  detected: boolean;
  mapping: TransactionColumnMapping;
  recognizedFields: TransactionMappingField[];
  ambiguousFields: TransactionMappingField[];
};

/** Normalizes a gateway header without changing its semantic words. */
export function normalizeTransactionHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

/** Returns the exact ordered normalized header layout used for safe mapping reuse. */
export function normalizeTransactionHeaderRow(row: readonly unknown[]) {
  return row.map((value) => normalizeTransactionHeader(value));
}

/**
 * Auto-maps only exact known header aliases. Required fields must each have one unique match;
 * ambiguous headers are deliberately left unmapped so Mizan never guesses a financial column.
 */
export function autoMapTransactionHeaderRow(row: readonly unknown[]): TransactionHeaderAutoMapping {
  const normalizedHeaders = normalizeTransactionHeaderRow(row);
  let mapping: TransactionColumnMapping = { ...EMPTY_TRANSACTION_COLUMN_MAPPING };
  const recognizedFields: TransactionMappingField[] = [];
  const ambiguousFields: TransactionMappingField[] = [];

  for (const field of TRANSACTION_MAPPING_FIELDS) {
    const aliases = new Set(
      TRANSACTION_HEADER_ALIASES[field].map((alias) => normalizeTransactionHeader(alias)),
    );
    const matches = normalizedHeaders.flatMap((header, index) => (aliases.has(header) ? [index] : []));

    if (matches.length === 1) {
      mapping = setTransactionFieldColumn(mapping, field, matches[0] as number);
      recognizedFields.push(field);
    } else if (matches.length > 1) {
      ambiguousFields.push(field);
    }
  }

  const state = inspectTransactionColumnMapping(mapping);
  return {
    detected: state.isComplete,
    mapping,
    recognizedFields,
    ambiguousFields,
  };
}

/** Creates a stable SHA-256 fingerprint for one exact ordered normalized header layout. */
export async function fingerprintTransactionHeaderRow(row: readonly unknown[]) {
  const normalized = normalizeTransactionHeaderRow(row);
  const payload = new TextEncoder().encode(JSON.stringify(normalized));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Parses persisted JSON defensively and rejects stale/out-of-range or incomplete mappings. */
export function parseStoredTransactionColumnMapping(
  value: unknown,
  totalColumns: number,
): TransactionColumnMapping | null {
  if (!Number.isSafeInteger(totalColumns) || totalColumns <= 0) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  let mapping: TransactionColumnMapping = { ...EMPTY_TRANSACTION_COLUMN_MAPPING };

  for (const field of TRANSACTION_MAPPING_FIELDS) {
    const raw = record[field];
    if (raw === null || raw === undefined) {
      mapping = setTransactionFieldColumn(mapping, field, null);
      continue;
    }
    if (!Number.isSafeInteger(raw) || Number(raw) < 0 || Number(raw) >= totalColumns) return null;
    mapping = setTransactionFieldColumn(mapping, field, Number(raw));
  }

  return inspectTransactionColumnMapping(mapping).isComplete ? mapping : null;
}

/** Builds bounded native column choices while sampling only the preview-visible columns. */
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

/** Reports whether required fields are complete and whether any source column is assigned twice. */
export function inspectTransactionColumnMapping(
  mapping: TransactionColumnMapping,
): TransactionColumnMappingState {
  const missingFields = REQUIRED_TRANSACTION_FIELDS.filter((field) => mapping[field] === null);
  const selectedColumns = TRANSACTION_MAPPING_FIELDS.flatMap((field) => {
    const column = mapping[field] ?? null;
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

/** Returns a new mapping with one field assigned to a validated zero-based source column. */
export function setTransactionFieldColumn(
  mapping: TransactionColumnMapping,
  field: TransactionMappingField,
  column: number | null,
): TransactionColumnMapping {
  if (column !== null && (!Number.isSafeInteger(column) || column < 0)) {
    throw new RangeError("Transaction mapping column must be a non-negative integer or null.");
  }

  return { ...mapping, [field]: column };
}
