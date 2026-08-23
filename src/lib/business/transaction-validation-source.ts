import {
  attributeValue,
  cellDisplayValue,
  columnIndexFromReference,
  decodeCsvBuffer,
  detectCsvDelimiter,
  readFirstXlsxWorksheet,
  TRANSACTION_SOURCE_LIMITS,
  TransactionSourceParseError,
  type XlsxStyles,
} from "./transaction-source-parser.ts";

export const TRANSACTION_VALIDATION_SOURCE_LIMITS = {
  maxRows: 100_000,
} as const;

export type TransactionValidationSourceRow = {
  rowNumber: number;
  values: string[];
};

export type TransactionValidationSourceResult = {
  rows: TransactionValidationSourceRow[];
  totalRows: number;
};

export type TransactionValidationSourceErrorCode =
  | "INVALID_MAPPING"
  | "SOURCE_BYTES_MISMATCH"
  | "SOURCE_ENCODING_UNSUPPORTED"
  | "SOURCE_CSV_MALFORMED"
  | "SOURCE_XLSX_INVALID"
  | "SOURCE_XLSX_UNSUPPORTED"
  | "SOURCE_TOO_MANY_ROWS"
  | "UNSUPPORTED_FILE_TYPE";

export class TransactionValidationSourceError extends Error {
  readonly code: TransactionValidationSourceErrorCode;

  constructor(code: TransactionValidationSourceErrorCode, message: string) {
    super(message);
    this.name = "TransactionValidationSourceError";
    this.code = code;
  }
}

type SelectedColumns = {
  ordered: number[];
  positions: Map<number, number>;
};

function fail(code: TransactionValidationSourceErrorCode, message: string): never {
  throw new TransactionValidationSourceError(code, message);
}

function rethrowSharedSourceError(error: unknown): never {
  if (!(error instanceof TransactionSourceParseError)) throw error;

  if (error.code === "CSV_ENCODING_UNSUPPORTED") {
    fail("SOURCE_ENCODING_UNSUPPORTED", error.message);
  }
  if (
    error.code === "XLSX_INVALID_ARCHIVE" ||
    error.code === "XLSX_WORKBOOK_MISSING" ||
    error.code === "XLSX_SHEET_MISSING"
  ) {
    fail("SOURCE_XLSX_INVALID", error.message);
  }
  fail("SOURCE_XLSX_UNSUPPORTED", error.message);
}

function selectedColumns(columns: readonly number[]): SelectedColumns {
  if (columns.length === 0) fail("INVALID_MAPPING", "At least one mapped source column is required.");

  const positions = new Map<number, number>();
  columns.forEach((column, position) => {
    if (!Number.isSafeInteger(column) || column < 0) {
      fail("INVALID_MAPPING", "Mapped source columns must be non-negative integers.");
    }
    if (positions.has(column)) {
      fail("INVALID_MAPPING", "Mapped source columns must be unique.");
    }
    positions.set(column, position);
  });

  return { ordered: [...columns], positions };
}

function assertSourceBoundary(fileSize: number, buffer: ArrayBuffer) {
  if (
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > TRANSACTION_SOURCE_LIMITS.maxFileBytes
  ) {
    fail("SOURCE_BYTES_MISMATCH", "The selected source file is outside the supported file boundary.");
  }
  if (buffer.byteLength !== fileSize) {
    fail("SOURCE_BYTES_MISMATCH", "Source bytes do not match the selected file size.");
  }
}

function extensionOf(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot === -1 ? "" : normalized.slice(dot + 1);
}

function scanSelectedCsvRows(text: string, delimiter: string, selected: SelectedColumns) {
  if (![",", ";", "\t"].includes(delimiter)) {
    fail("SOURCE_CSV_MALFORMED", "Unsupported CSV delimiter.");
  }

  const rows: TransactionValidationSourceRow[] = [];
  let rowNumber = 1;
  let columnNumber = 0;
  let cell = "";
  let cellHasContent = false;
  let rowHasContent = false;
  let quoted = false;
  let justClosedQuote = false;
  let values = Array.from({ length: selected.ordered.length }, () => "");

  const appendCellCharacter = (char: string) => {
    cellHasContent = true;
    if (selected.positions.has(columnNumber)) cell += char;
  };

  const pushCell = () => {
    const targetPosition = selected.positions.get(columnNumber);
    if (targetPosition !== undefined) values[targetPosition] = cell;
    rowHasContent ||= cellHasContent;
    columnNumber += 1;
    cell = "";
    cellHasContent = false;
    justClosedQuote = false;
  };

  const pushRow = () => {
    pushCell();
    if (rowHasContent) {
      if (rows.length >= TRANSACTION_VALIDATION_SOURCE_LIMITS.maxRows) {
        fail("SOURCE_TOO_MANY_ROWS", "The source contains too many rows for browser validation.");
      }
      rows.push({ rowNumber, values });
    }
    rowNumber += 1;
    columnNumber = 0;
    values = Array.from({ length: selected.ordered.length }, () => "");
    rowHasContent = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          appendCellCharacter('"');
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        appendCellCharacter(char);
      }
      continue;
    }

    if (char === '"') {
      if (!cellHasContent && cell.length === 0 && !justClosedQuote) {
        quoted = true;
        continue;
      }
      fail("SOURCE_CSV_MALFORMED", "Unexpected quote in CSV field.");
    }

    if (char === delimiter) {
      pushCell();
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
      continue;
    }

    if (justClosedQuote) {
      if (char === " " || char === "\t") continue;
      fail("SOURCE_CSV_MALFORMED", "Unexpected data after a quoted CSV field.");
    }

    appendCellCharacter(char);
  }

  if (quoted) fail("SOURCE_CSV_MALFORMED", "CSV contains an unterminated quoted field.");
  if (cellHasContent || columnNumber > 0 || justClosedQuote) pushRow();
  return rows;
}

function parseSelectedWorksheetRows(
  worksheetXml: string,
  selected: SelectedColumns,
  sharedStrings: string[],
  styles: XlsxStyles,
  date1904: boolean,
) {
  const rows: TransactionValidationSourceRow[] = [];
  let parsedRowNumber = 0;
  const rowPattern =
    /<((?:[A-Za-z_][\w.-]*:)?row\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>|\s*\/>)/gi;

  for (const rowMatch of worksheetXml.matchAll(rowPattern)) {
    parsedRowNumber += 1;
    const explicitRowNumber = Number(attributeValue(rowMatch[1], "r"));
    const rowNumber =
      Number.isSafeInteger(explicitRowNumber) && explicitRowNumber > 0
        ? explicitRowNumber
        : parsedRowNumber;
    const rowBody = rowMatch[2] ?? "";
    const values = Array.from({ length: selected.ordered.length }, () => "");
    let rowHasContent = false;
    let sequentialColumn = 0;
    const cellPattern =
      /<((?:[A-Za-z_][\w.-]*:)?c\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>|\s*\/>)/gi;

    for (const cellMatch of rowBody.matchAll(cellPattern)) {
      const tag = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const referencedColumn = columnIndexFromReference(attributeValue(tag, "r"));
      const column = referencedColumn ?? sequentialColumn;
      const value = cellDisplayValue(tag, body, sharedStrings, styles, date1904);
      rowHasContent ||= value !== "";
      const targetPosition = selected.positions.get(column);
      if (targetPosition !== undefined) values[targetPosition] = value;
      sequentialColumn = column + 1;
    }

    if (!rowHasContent) continue;
    if (rows.length >= TRANSACTION_VALIDATION_SOURCE_LIMITS.maxRows) {
      fail("SOURCE_TOO_MANY_ROWS", "The source contains too many rows for browser validation.");
    }
    rows.push({ rowNumber, values });
  }

  return rows;
}

async function readSelectedXlsxRows(buffer: ArrayBuffer, selected: SelectedColumns) {
  try {
    const source = await readFirstXlsxWorksheet(buffer);
    return parseSelectedWorksheetRows(
      source.worksheetXml,
      selected,
      source.sharedStrings,
      source.styles,
      source.date1904,
    );
  } catch (error) {
    if (error instanceof TransactionValidationSourceError) throw error;
    rethrowSharedSourceError(error);
  }
}

export async function readTransactionValidationSource(input: {
  fileName: string;
  fileSize: number;
  buffer: ArrayBuffer;
  columns: readonly number[];
}): Promise<TransactionValidationSourceResult> {
  assertSourceBoundary(input.fileSize, input.buffer);
  const selected = selectedColumns(input.columns);
  const extension = extensionOf(input.fileName);

  let rows: TransactionValidationSourceRow[];
  if (extension === "csv") {
    try {
      const text = decodeCsvBuffer(input.buffer);
      rows = scanSelectedCsvRows(text, detectCsvDelimiter(text), selected);
    } catch (error) {
      if (error instanceof TransactionValidationSourceError) throw error;
      rethrowSharedSourceError(error);
    }
  } else if (extension === "xlsx") {
    rows = await readSelectedXlsxRows(input.buffer, selected);
  } else {
    fail("UNSUPPORTED_FILE_TYPE", "Only CSV and XLSX files are supported.");
  }

  return { rows, totalRows: rows.length };
}
