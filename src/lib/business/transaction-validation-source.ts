import {
  detectCsvDelimiter,
  TRANSACTION_PREVIEW_LIMITS,
} from "./transaction-preview.ts";

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

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type XlsxStyles = {
  dateStyleIndexes: Set<number>;
};

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const UTF8_LENIENT = new TextDecoder("utf-8");
const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
const BUILTIN_DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47,
  50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

function fail(code: TransactionValidationSourceErrorCode, message: string): never {
  throw new TransactionValidationSourceError(code, message);
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
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > TRANSACTION_PREVIEW_LIMITS.maxFileBytes) {
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

function decodeCsvBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  try {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
    }
    const start =
      bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
    const decoded = UTF8.decode(bytes.subarray(start));
    if (decoded.includes("\u0000")) fail("SOURCE_ENCODING_UNSUPPORTED", "CSV contains binary data.");
    return decoded;
  } catch (error) {
    if (error instanceof TransactionValidationSourceError) throw error;
    fail("SOURCE_ENCODING_UNSUPPORTED", "CSV must be UTF-8 or UTF-16 with a byte-order mark.");
  }
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

function decodeXmlEntities(value: string) {
  return value.replace(XML_ENTITY_PATTERN, (entity) => {
    if (entity === "&amp;") return "&";
    if (entity === "&lt;") return "<";
    if (entity === "&gt;") return ">";
    if (entity === "&quot;") return '"';
    if (entity === "&apos;") return "'";
    const radix = entity.startsWith("&#x") ? 16 : 10;
    const start = radix === 16 ? 3 : 2;
    const codePoint = Number.parseInt(entity.slice(start, -1), radix);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}

function decodeXmlText(value: string) {
  return decodeXmlEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function attributeValue(tag: string, attributeName: string) {
  const escaped = escapeRegex(attributeName);
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  const raw = match?.[1] ?? match?.[2];
  return raw === undefined ? null : decodeXmlEntities(raw);
}

function namespacedIdValue(tag: string) {
  const match = tag.match(/(?:^|\s)(?:[A-Za-z_][\w.-]*:)?id\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const raw = match?.[1] ?? match?.[2];
  return raw === undefined ? null : decodeXmlEntities(raw);
}

function normalizeZipPath(value: string) {
  const parts: string[] = [];
  for (const segment of value.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) fail("SOURCE_XLSX_INVALID", "XLSX contains an unsafe archive path.");
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  return parts.join("/");
}

function resolveZipPath(baseFile: string, target: string) {
  if (target.startsWith("/")) return normalizeZipPath(target.slice(1));
  const slash = baseFile.lastIndexOf("/");
  const baseDirectory = slash === -1 ? "" : baseFile.slice(0, slash + 1);
  return normalizeZipPath(`${baseDirectory}${target}`);
}

function findZipEnd(view: DataView) {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === ZIP_END_SIGNATURE &&
      offset + 22 + view.getUint16(offset + 20, true) === view.byteLength
    ) return offset;
  }
  fail("SOURCE_XLSX_INVALID", "XLSX ZIP end record is missing.");
}

function readZipDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 22) fail("SOURCE_XLSX_INVALID", "XLSX archive is too small.");

  const endOffset = findZipEnd(view);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const totalEntries = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    fail("SOURCE_XLSX_UNSUPPORTED", "Multi-disk XLSX archives are not supported.");
  }
  if (totalEntries === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    fail("SOURCE_XLSX_UNSUPPORTED", "ZIP64 XLSX files are not supported.");
  }
  if (totalEntries > TRANSACTION_PREVIEW_LIMITS.maxZipEntries) {
    fail("SOURCE_XLSX_UNSUPPORTED", "XLSX contains too many archive entries.");
  }
  if (centralOffset + centralSize > view.byteLength) {
    fail("SOURCE_XLSX_INVALID", "XLSX central directory exceeds file boundaries.");
  }

  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      fail("SOURCE_XLSX_INVALID", "XLSX central directory entry is malformed.");
    }
    const flags = view.getUint16(offset + 8, true);
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;

    if (recordEnd > view.byteLength) fail("SOURCE_XLSX_INVALID", "XLSX entry exceeds file boundaries.");
    if ((flags & 0x0001) !== 0) fail("SOURCE_XLSX_UNSUPPORTED", "Encrypted XLSX files are not supported.");
    if (![0, 8].includes(compressionMethod)) {
      fail("SOURCE_XLSX_UNSUPPORTED", "XLSX uses an unsupported ZIP compression method.");
    }
    if ([compressedSize, uncompressedSize, localHeaderOffset].includes(0xffffffff)) {
      fail("SOURCE_XLSX_UNSUPPORTED", "ZIP64 XLSX files are not supported.");
    }

    const name = normalizeZipPath(UTF8_LENIENT.decode(new Uint8Array(buffer, offset + 46, nameLength)));
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > TRANSACTION_PREVIEW_LIMITS.maxXlsxUncompressedBytes) {
      fail("SOURCE_XLSX_UNSUPPORTED", "XLSX expands beyond the safe browser limit.");
    }
    entries.set(name, { name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset = recordEnd;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array, expectedSize: number) {
  try {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    const reader = new Blob([ownedBytes.buffer])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"))
      .getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > expectedSize || total > TRANSACTION_PREVIEW_LIMITS.maxXlsxUncompressedBytes) {
        await reader.cancel();
        fail("SOURCE_XLSX_UNSUPPORTED", "XLSX entry expands beyond its declared safe size.");
      }
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      chunks.push(copy);
    }
    if (total !== expectedSize) fail("SOURCE_XLSX_INVALID", "XLSX entry size does not match ZIP metadata.");
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } catch (error) {
    if (error instanceof TransactionValidationSourceError) throw error;
    fail("SOURCE_XLSX_INVALID", "XLSX compressed data could not be decompressed.");
  }
}

async function extractZipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > view.byteLength || view.getUint32(offset, true) !== ZIP_LOCAL_FILE_SIGNATURE) {
    fail("SOURCE_XLSX_INVALID", "XLSX local header is missing.");
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > view.byteLength) fail("SOURCE_XLSX_INVALID", "XLSX entry exceeds file boundaries.");
  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  if (entry.compressionMethod === 8) return inflateRaw(compressed, entry.uncompressedSize);
  if (entry.compressedSize !== entry.uncompressedSize) {
    fail("SOURCE_XLSX_INVALID", "Stored XLSX entry has inconsistent size metadata.");
  }
  const output = new Uint8Array(entry.uncompressedSize);
  output.set(compressed);
  return output;
}

async function extractZipText(buffer: ArrayBuffer, entries: Map<string, ZipEntry>, path: string) {
  const entry = entries.get(normalizeZipPath(path));
  if (!entry) return null;
  const bytes = await extractZipEntry(buffer, entry);
  try {
    return UTF8.decode(bytes);
  } catch {
    fail("SOURCE_XLSX_INVALID", `XLSX XML is not valid UTF-8: ${path}.`);
  }
}

function firstWorksheet(workbookXml: string, relationshipsXml: string) {
  const sheetTag = workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/i)?.[0];
  if (!sheetTag) fail("SOURCE_XLSX_INVALID", "XLSX workbook has no worksheet.");
  const relationshipId = attributeValue(sheetTag, "r:id") ?? namespacedIdValue(sheetTag);
  if (!relationshipId) fail("SOURCE_XLSX_INVALID", "XLSX worksheet relationship is missing.");
  const relationshipTags =
    relationshipsXml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*\/?\s*>/gi) ?? [];
  const relationshipTag = relationshipTags.find((tag) => attributeValue(tag, "Id") === relationshipId);
  const target = relationshipTag ? attributeValue(relationshipTag, "Target") : null;
  if (!target) fail("SOURCE_XLSX_INVALID", "XLSX worksheet target is missing.");
  return resolveZipPath("xl/workbook.xml", target);
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [];
  const values: string[] = [];
  const itemPattern = /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi;
  for (const itemMatch of xml.matchAll(itemPattern)) {
    const fragments: string[] = [];
    const textPattern = /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi;
    for (const textMatch of itemMatch[1].matchAll(textPattern)) fragments.push(decodeXmlText(textMatch[1]));
    values.push(fragments.join(""));
  }
  return values;
}

function customFormatLooksLikeDate(formatCode: string) {
  const stripped = formatCode
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/_.|\*./g, "")
    .toLowerCase();
  return /(^|[^a-z])[ymdhis]+([^a-z]|$)/.test(stripped) || /[ymdhs]/.test(stripped.replace(/[0#?.,%e+-]/g, ""));
}

function parseStyles(xml: string | null): XlsxStyles {
  const dateFormatIds = new Set(BUILTIN_DATE_FORMAT_IDS);
  if (!xml) return { dateStyleIndexes: new Set() };
  const customFormats = xml.match(/<(?:[A-Za-z_][\w.-]*:)?numFmt\b[^>]*\/?\s*>/gi) ?? [];
  for (const tag of customFormats) {
    const id = Number(attributeValue(tag, "numFmtId"));
    const code = attributeValue(tag, "formatCode");
    if (Number.isInteger(id) && code && customFormatLooksLikeDate(code)) dateFormatIds.add(id);
  }
  const cellXfs = xml.match(/<(?:[A-Za-z_][\w.-]*:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?cellXfs>/i)?.[1];
  const dateStyleIndexes = new Set<number>();
  if (!cellXfs) return { dateStyleIndexes };
  const xfTags = cellXfs.match(/<(?:[A-Za-z_][\w.-]*:)?xf\b[^>]*\/?\s*>/gi) ?? [];
  xfTags.forEach((tag, index) => {
    const numFmtId = Number(attributeValue(tag, "numFmtId") ?? 0);
    if (dateFormatIds.has(numFmtId)) dateStyleIndexes.add(index);
  });
  return { dateStyleIndexes };
}

function columnIndexFromReference(reference: string | null) {
  if (!reference) return null;
  const letters = reference.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();
  if (!letters) return null;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function excelDateString(serialText: string, date1904: boolean) {
  const serial = Number(serialText);
  if (!Number.isFinite(serial)) return serialText;
  const wholeDays = Math.trunc(serial);
  const fraction = serial - wholeDays;
  if (!date1904 && wholeDays === 60 && fraction === 0) return "1900-02-29";
  const adjustedDays = date1904 ? wholeDays : wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const millis = epoch + adjustedDays * 86_400_000 + Math.round(fraction * 86_400_000);
  const date = new Date(millis);
  if (!Number.isFinite(date.getTime())) return serialText;
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace("T", " ").replace(/\.000Z$/, "Z");
}

function textFragments(xml: string) {
  const fragments: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi;
  for (const match of xml.matchAll(pattern)) fragments.push(decodeXmlText(match[1]));
  return fragments.join("");
}

function cellDisplayValue(tag: string, body: string, sharedStrings: string[], styles: XlsxStyles, date1904: boolean) {
  const type = attributeValue(tag, "t");
  if (type === "inlineStr") return textFragments(body);
  const rawValue = body.match(/<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i)?.[1];
  if (rawValue === undefined) return textFragments(body);
  const value = decodeXmlText(rawValue);
  if (type === "s") {
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 ? (sharedStrings[index] ?? "") : "";
  }
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  if (type === "str" || type === "e" || type === "d") return value;
  const styleIndex = Number(attributeValue(tag, "s") ?? -1);
  return Number.isInteger(styleIndex) && styles.dateStyleIndexes.has(styleIndex)
    ? excelDateString(value, date1904)
    : value;
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
  const rowPattern = /<((?:[A-Za-z_][\w.-]*:)?row\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?row\s*>|\s*\/>)/gi;

  for (const rowMatch of worksheetXml.matchAll(rowPattern)) {
    parsedRowNumber += 1;
    const rowBody = rowMatch[2] ?? "";
    const values = Array.from({ length: selected.ordered.length }, () => "");
    let rowHasContent = false;
    let sequentialColumn = 0;
    const cellPattern = /<((?:[A-Za-z_][\w.-]*:)?c\b[^>]*?)(?:>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?c\s*>|\s*\/>)/gi;

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
    rows.push({ rowNumber: parsedRowNumber, values });
  }

  return rows;
}

async function readSelectedXlsxRows(buffer: ArrayBuffer, selected: SelectedColumns) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    fail("SOURCE_XLSX_INVALID", "XLSX does not contain a ZIP signature.");
  }
  const entries = readZipDirectory(buffer);
  const workbookXml = await extractZipText(buffer, entries, "xl/workbook.xml");
  const relationshipsXml = await extractZipText(buffer, entries, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relationshipsXml) fail("SOURCE_XLSX_INVALID", "XLSX workbook metadata is missing.");
  const worksheetPath = firstWorksheet(workbookXml, relationshipsXml);
  const worksheetXml = await extractZipText(buffer, entries, worksheetPath);
  if (!worksheetXml) fail("SOURCE_XLSX_INVALID", "The first XLSX worksheet could not be found.");
  const [sharedStringsXml, stylesXml] = await Promise.all([
    extractZipText(buffer, entries, "xl/sharedStrings.xml"),
    extractZipText(buffer, entries, "xl/styles.xml"),
  ]);
  const date1904 = /<(?:[A-Za-z_][\w.-]*:)?workbookPr\b[^>]*date1904\s*=\s*(?:"(?:1|true)"|'(?:1|true)')/i.test(workbookXml);
  return parseSelectedWorksheetRows(
    worksheetXml,
    selected,
    parseSharedStrings(sharedStringsXml),
    parseStyles(stylesXml),
    date1904,
  );
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
    const text = decodeCsvBuffer(input.buffer);
    rows = scanSelectedCsvRows(text, detectCsvDelimiter(text), selected);
  } else if (extension === "xlsx") {
    rows = await readSelectedXlsxRows(input.buffer, selected);
  } else {
    fail("UNSUPPORTED_FILE_TYPE", "Only CSV and XLSX files are supported.");
  }

  return { rows, totalRows: rows.length };
}
