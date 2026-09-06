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

/** Rejects file metadata or bytes that fall outside the supported transaction-import boundary. */
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

/** Returns the lowercase file extension used to choose the transaction source parser. */
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

  /** Appends one decoded character to the active CSV header cell. */
  const appendCellCharacter = (char: string) => {
    cellHasContent = true;
    cell += char;
  };

  /** Finalizes the active CSV cell while enforcing the supported column boundary. */
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

  /** Finalizes a CSV row and returns it only when at least one cell contains content. */
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

/**
 * Materializes a sparse worksheet row only when it contains real content.
 * Blank sparse rows therefore never allocate a dense array up to a far-right XLSX column.
 */
export function materializeTransactionHeaderRow(
  cells: ReadonlyMap<number, string>,
  maxColumn: number,
  rowHasContent: boolean,
) {
  if (!rowHasContent || maxColumn < 0) return null;
  if (!Number.isSafeInteger(maxColumn) || maxColumn >= TRANSACTION_HEADER_COLUMN_LIMIT) {
    throw new RangeError("Transaction XLSX header exceeds the supported column limit.");
  }

  const values = Array.from({ length: maxColumn + 1 }, () => "");
  for (const [column, value] of cells) {
    if (!Number.isSafeInteger(column) || column < 0 || column > maxColumn) {
      throw new RangeError("Transaction XLSX header contains an invalid column position.");
    }
    values[column] = value;
  }
  return values;
}

/** Returns the first non-empty XLSX worksheet row with sparse column positions preserved. */
function firstNonEmptyWorksheetRow(source: Awaited<ReturnType<typeof readFirstXlsxWorksheet>>) {
  const rowPattern =
    /<((?:[A-Za-z_][\w.-]*:)?row\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>|\s*\/>)/gi;

  for (const rowMatch of source.worksheetXml.matchAll(rowPattern)) {
    const rowBody = rowMatch[2] ?? "";
    const cells = new Map<number, string>();
    let maxColumn = -1;
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
      maxColumn = Math.max(maxColumn, column);
      if (value !== "") {
        cells.set(column, value);
        rowHasContent = true;
      }
      sequentialColumn = column + 1;
    }

    const values = materializeTransactionHeaderRow(cells, maxColumn, rowHasContent);
    if (values) return values;
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
