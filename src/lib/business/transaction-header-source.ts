import {
  attributeValue,
  cellDisplayValue,
  columnIndexFromReference,
  decodeCsvBuffer,
  detectCsvDelimiter,
  readFirstXlsxWorksheet,
  TRANSACTION_SOURCE_LIMITS,
} from "./transaction-source-parser.ts";

const TRANSACTION_HEADER_COLUMN_LIMIT = 100_000;

function assertSourceBoundary(fileSize: number, buffer: ArrayBuffer) {
  if (
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > TRANSACTION_SOURCE_LIMITS.maxFileBytes ||
    buffer.byteLength !== fileSize
  ) {
    throw new RangeError("Transaction header source bytes are outside the supported boundary.");
  }
}

function extensionOf(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot === -1 ? "" : normalized.slice(dot + 1);
}

/** Returns the first non-empty CSV row with every source column preserved. */
function firstNonEmptyCsvRow(text: string, delimiter: string) {
  if (![",", ";", "\t"].includes(delimiter)) return null;

  let row: string[] = [];
  let cell = "";
  let cellHasContent = false;
  let rowHasContent = false;
  let quoted = false;
  let justClosedQuote = false;

  const appendCellCharacter = (char: string) => {
    cellHasContent = true;
    cell += char;
  };

  const pushCell = () => {
    if (row.length >= TRANSACTION_HEADER_COLUMN_LIMIT) {
      throw new RangeError("Transaction header exceeds the supported column limit.");
    }
    row.push(cell);
    rowHasContent ||= cellHasContent;
    cell = "";
    cellHasContent = false;
    justClosedQuote = false;
  };

  const finishRow = () => {
    pushCell();
    if (rowHasContent) return row;
    row = [];
    rowHasContent = false;
    return null;
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
      throw new Error("Unexpected quote in transaction CSV header source.");
    }

    if (char === delimiter) {
      pushCell();
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      const completed = finishRow();
      if (completed) return completed;
      continue;
    }

    if (justClosedQuote) {
      if (char === " " || char === "\t") continue;
      throw new Error("Unexpected data after a quoted transaction CSV header field.");
    }

    appendCellCharacter(char);
  }

  if (quoted) throw new Error("Transaction CSV header contains an unterminated quoted field.");
  if (cellHasContent || row.length > 0 || justClosedQuote) return finishRow();
  return null;
}

/** Returns the first non-empty XLSX worksheet row with sparse column positions preserved. */
function firstNonEmptyWorksheetRow(source: Awaited<ReturnType<typeof readFirstXlsxWorksheet>>) {
  const rowPattern =
    /<((?:[A-Za-z_][\w.-]*:)?row\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>|\s*\/>)/gi;

  for (const rowMatch of source.worksheetXml.matchAll(rowPattern)) {
    const rowBody = rowMatch[2] ?? "";
    const values: string[] = [];
    let rowHasContent = false;
    let sequentialColumn = 0;
    const cellPattern =
      /<((?:[A-Za-z_][\w.-]*:)?c\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>|\s*\/>)/gi;

    for (const cellMatch of rowBody.matchAll(cellPattern)) {
      const tag = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const referencedColumn = columnIndexFromReference(attributeValue(tag, "r"));
      const column = referencedColumn ?? sequentialColumn;
      if (!Number.isSafeInteger(column) || column < 0 || column >= TRANSACTION_HEADER_COLUMN_LIMIT) {
        throw new RangeError("Transaction XLSX header exceeds the supported column limit.");
      }

      const value = cellDisplayValue(
        tag,
        body,
        source.sharedStrings,
        source.styles,
        source.date1904,
      );
      while (values.length <= column) values.push("");
      values[column] = value;
      rowHasContent ||= value !== "";
      sequentialColumn = column + 1;
    }

    if (rowHasContent) return values;
  }

  return null;
}

/**
 * Reads the complete first non-empty source row used as the gateway-header identity.
 * It deliberately does not use the truncated UI preview, so leading blank records and
 * columns beyond the preview boundary cannot cause stale saved mappings to be reused.
 */
export async function readTransactionHeaderRow(input: {
  fileName: string;
  fileSize: number;
  buffer: ArrayBuffer;
}): Promise<string[] | null> {
  assertSourceBoundary(input.fileSize, input.buffer);
  const extension = extensionOf(input.fileName);

  if (extension === "csv") {
    const text = decodeCsvBuffer(input.buffer);
    return firstNonEmptyCsvRow(text, detectCsvDelimiter(text));
  }

  if (extension === "xlsx") {
    const source = await readFirstXlsxWorksheet(input.buffer);
    return firstNonEmptyWorksheetRow(source);
  }

  return null;
}
