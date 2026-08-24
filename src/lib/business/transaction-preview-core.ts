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

export { detectCsvDelimiter };

export const TRANSACTION_PREVIEW_LIMITS = {
  ...TRANSACTION_SOURCE_LIMITS,
  previewRows: 25,
  previewColumns: 20,
} as const;

export type TransactionPreviewFileType = "csv" | "xlsx";

export type TransactionFilePreview = {
  fileName: string;
  fileSize: number;
  fileType: TransactionPreviewFileType;
  sheetName: string | null;
  delimiter: string | null;
  totalRows: number;
  totalColumns: number;
  previewRows: string[][];
  truncatedRows: boolean;
  truncatedColumns: boolean;
};

export type TransactionPreviewErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "CSV_ENCODING_UNSUPPORTED"
  | "CSV_MALFORMED"
  | "XLSX_INVALID_ARCHIVE"
  | "XLSX_UNSUPPORTED_ARCHIVE"
  | "XLSX_TOO_LARGE"
  | "XLSX_WORKBOOK_MISSING"
  | "XLSX_SHEET_MISSING";

export class TransactionPreviewError extends Error {
  readonly code: TransactionPreviewErrorCode;

  constructor(code: TransactionPreviewErrorCode, message: string) {
    super(message);
    this.name = "TransactionPreviewError";
    this.code = code;
  }
}

type ParsedRows = {
  rows: string[][];
  totalRows: number;
  totalColumns: number;
};

function fail(code: TransactionPreviewErrorCode, message: string): never {
  throw new TransactionPreviewError(code, message);
}

function extensionOf(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot === -1 ? "" : normalized.slice(dot + 1);
}

function assertFileBoundary(fileSize: number) {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    fail("EMPTY_FILE", "The selected file is empty.");
  }
  if (fileSize > TRANSACTION_PREVIEW_LIMITS.maxFileBytes) {
    fail("FILE_TOO_LARGE", "The selected file exceeds the preview size limit.");
  }
}

function rethrowSourceError(error: unknown): never {
  if (error instanceof TransactionSourceParseError) {
    fail(error.code, error.message);
  }
  throw error;
}

function scanCsvRows(text: string, delimiter: string): ParsedRows {
  if (![",", ";", "\t"].includes(delimiter)) {
    fail("CSV_MALFORMED", "Unsupported CSV delimiter.");
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let rowNumber = 1;
  let columnNumber = 0;
  let cell = "";
  let cellHasContent = false;
  let rowHasContent = false;
  let quoted = false;
  let justClosedQuote = false;
  let totalRows = 0;
  let totalColumns = 0;
  let pendingColumns = 0;

  const retainCell = () =>
    rowNumber <= TRANSACTION_PREVIEW_LIMITS.previewRows &&
    columnNumber < TRANSACTION_PREVIEW_LIMITS.previewColumns;

  const appendCellCharacter = (char: string) => {
    cellHasContent = true;
    if (retainCell()) cell += char;
  };

  const pushCell = () => {
    if (retainCell()) row.push(cell);
    rowHasContent ||= cellHasContent;
    columnNumber += 1;
    cell = "";
    cellHasContent = false;
    justClosedQuote = false;
  };

  const pushRow = () => {
    pushCell();
    pendingColumns = Math.max(pendingColumns, columnNumber);
    if (rowNumber <= TRANSACTION_PREVIEW_LIMITS.previewRows) rows.push(row);
    if (rowHasContent) {
      totalRows = rowNumber;
      totalColumns = Math.max(totalColumns, pendingColumns);
      pendingColumns = 0;
    }
    rowNumber += 1;
    columnNumber = 0;
    row = [];
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
      fail("CSV_MALFORMED", "Unexpected quote in CSV field.");
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
      fail("CSV_MALFORMED", "Unexpected data after a quoted CSV field.");
    }

    appendCellCharacter(char);
  }

  if (quoted) fail("CSV_MALFORMED", "CSV contains an unterminated quoted field.");
  if (cellHasContent || columnNumber > 0 || justClosedQuote) pushRow();

  return {
    rows: rows.slice(0, Math.min(totalRows, TRANSACTION_PREVIEW_LIMITS.previewRows)),
    totalRows,
    totalColumns,
  };
}

export function parseCsvRows(text: string, delimiter = detectCsvDelimiter(text)) {
  return scanCsvRows(text, delimiter).rows;
}

function previewFromParsed(
  fileName: string,
  fileSize: number,
  fileType: TransactionPreviewFileType,
  parsed: ParsedRows,
  options: { sheetName?: string | null; delimiter?: string | null } = {},
): TransactionFilePreview {
  return {
    fileName,
    fileSize,
    fileType,
    sheetName: options.sheetName ?? null,
    delimiter: options.delimiter ?? null,
    totalRows: parsed.totalRows,
    totalColumns: parsed.totalColumns,
    previewRows: parsed.rows,
    truncatedRows: parsed.totalRows > TRANSACTION_PREVIEW_LIMITS.previewRows,
    truncatedColumns: parsed.totalColumns > TRANSACTION_PREVIEW_LIMITS.previewColumns,
  };
}

export function parseWorksheetXml(
  worksheetXml: string,
  options: { sharedStrings?: string[]; styles?: XlsxStyles; date1904?: boolean } = {},
): ParsedRows {
  const sharedStrings = options.sharedStrings ?? [];
  const styles = options.styles ?? { dateStyleIndexes: new Set<number>() };
  const date1904 = options.date1904 ?? false;
  const rows: string[][] = [];
  let parsedRowNumber = 0;
  let totalRows = 0;
  let totalColumns = 0;
  let pendingColumns = 0;

  const rowPattern =
    /<((?:[A-Za-z_][\w.-]*:)?row\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>|\s*\/>)/gi;

  for (const rowMatch of worksheetXml.matchAll(rowPattern)) {
    parsedRowNumber += 1;
    const rowBody = rowMatch[2] ?? "";
    const row: string[] = [];
    let rowHasContent = false;
    let rowColumns = 0;
    let sequentialColumn = 0;
    const cellPattern =
      /<((?:[A-Za-z_][\w.-]*:)?c\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>|\s*\/>)/gi;

    for (const cellMatch of rowBody.matchAll(cellPattern)) {
      const tag = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const referencedColumn = columnIndexFromReference(attributeValue(tag, "r"));
      const column = referencedColumn ?? sequentialColumn;
      const value = cellDisplayValue(tag, body, sharedStrings, styles, date1904);
      rowColumns = Math.max(rowColumns, column + 1);
      rowHasContent ||= value !== "";

      if (
        parsedRowNumber <= TRANSACTION_PREVIEW_LIMITS.previewRows &&
        column < TRANSACTION_PREVIEW_LIMITS.previewColumns
      ) {
        while (row.length < column) row.push("");
        row[column] = value;
      }

      sequentialColumn = column + 1;
    }

    pendingColumns = Math.max(pendingColumns, rowColumns);
    if (parsedRowNumber <= TRANSACTION_PREVIEW_LIMITS.previewRows) rows.push(row);
    if (rowHasContent) {
      totalRows = parsedRowNumber;
      totalColumns = Math.max(totalColumns, pendingColumns);
      pendingColumns = 0;
    }
  }

  return {
    rows: rows.slice(0, Math.min(totalRows, TRANSACTION_PREVIEW_LIMITS.previewRows)),
    totalRows,
    totalColumns,
  };
}

async function parseXlsxRows(buffer: ArrayBuffer) {
  try {
    const source = await readFirstXlsxWorksheet(buffer);
    const parsed = parseWorksheetXml(source.worksheetXml, {
      sharedStrings: source.sharedStrings,
      styles: source.styles,
      date1904: source.date1904,
    });
    return { sheetName: source.sheetName, ...parsed };
  } catch (error) {
    rethrowSourceError(error);
  }
}

export async function buildTransactionFilePreview(input: {
  fileName: string;
  fileSize: number;
  buffer: ArrayBuffer;
}): Promise<TransactionFilePreview> {
  assertFileBoundary(input.fileSize);
  if (input.buffer.byteLength !== input.fileSize) {
    fail("EMPTY_FILE", "File bytes do not match the selected file size.");
  }

  const extension = extensionOf(input.fileName);
  if (extension === "csv") {
    try {
      const text = decodeCsvBuffer(input.buffer);
      const delimiter = detectCsvDelimiter(text);
      return previewFromParsed(input.fileName, input.fileSize, "csv", scanCsvRows(text, delimiter), {
        delimiter,
      });
    } catch (error) {
      if (error instanceof TransactionPreviewError) throw error;
      rethrowSourceError(error);
    }
  }

  if (extension === "xlsx") {
    const parsed = await parseXlsxRows(input.buffer);
    return previewFromParsed(input.fileName, input.fileSize, "xlsx", parsed, {
      sheetName: parsed.sheetName,
    });
  }

  fail("UNSUPPORTED_FILE_TYPE", "Only CSV and XLSX files are supported.");
}
