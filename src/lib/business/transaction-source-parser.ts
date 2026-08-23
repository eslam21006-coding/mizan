export const TRANSACTION_SOURCE_LIMITS = {
  maxFileBytes: 25 * 1024 * 1024,
  maxXlsxUncompressedBytes: 100 * 1024 * 1024,
  maxZipEntries: 20_000,
} as const;

export type TransactionSourceParseErrorCode =
  | "CSV_ENCODING_UNSUPPORTED"
  | "XLSX_INVALID_ARCHIVE"
  | "XLSX_UNSUPPORTED_ARCHIVE"
  | "XLSX_TOO_LARGE"
  | "XLSX_WORKBOOK_MISSING"
  | "XLSX_SHEET_MISSING";

export class TransactionSourceParseError extends Error {
  readonly code: TransactionSourceParseErrorCode;

  constructor(code: TransactionSourceParseErrorCode, message: string) {
    super(message);
    this.name = "TransactionSourceParseError";
    this.code = code;
  }
}

export type XlsxStyles = {
  dateStyleIndexes: Set<number>;
};

export type FirstXlsxWorksheet = {
  sheetName: string;
  worksheetXml: string;
  sharedStrings: string[];
  styles: XlsxStyles;
  date1904: boolean;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const UTF8_LENIENT = new TextDecoder("utf-8");
const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
const BUILTIN_DATE_FORMAT_IDS = new Set([
  14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56,
  57, 58,
]);

function fail(code: TransactionSourceParseErrorCode, message: string): never {
  throw new TransactionSourceParseError(code, message);
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

export function attributeValue(tag: string, attributeName: string) {
  const escaped = escapeRegex(attributeName);
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  const raw = match?.[1] ?? match?.[2];
  return raw === undefined ? null : decodeXmlEntities(raw);
}

function namespacedIdValue(tag: string) {
  const match = tag.match(
    /(?:^|\s)(?:[A-Za-z_][\w.-]*:)?id\s*=\s*(?:"([^"]*)"|'([^']*)')/i,
  );
  const raw = match?.[1] ?? match?.[2];
  return raw === undefined ? null : decodeXmlEntities(raw);
}

export function decodeCsvBuffer(buffer: ArrayBuffer) {
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
    if (decoded.includes("\u0000")) {
      fail("CSV_ENCODING_UNSUPPORTED", "CSV contains unsupported binary data.");
    }
    return decoded;
  } catch (error) {
    if (error instanceof TransactionSourceParseError) throw error;
    fail("CSV_ENCODING_UNSUPPORTED", "CSV must be UTF-8 or UTF-16 with a byte-order mark.");
  }
}

function sampleDelimiterCounts(text: string, delimiter: string) {
  const counts: number[] = [];
  let quoted = false;
  let count = 0;
  const limit = Math.min(text.length, 128 * 1024);

  for (let index = 0; index < limit && counts.length < 12; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) count += 1;
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      if (count > 0) counts.push(count);
      count = 0;
    }
  }

  if (counts.length === 0 && count > 0) counts.push(count);
  return counts;
}

export function detectCsvDelimiter(text: string) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    const counts = sampleDelimiterCounts(text, candidate);
    if (counts.length === 0) continue;

    const frequencies = new Map<number, number>();
    for (const count of counts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    const modeFrequency = Math.max(...frequencies.values());
    const modeCount =
      [...frequencies.entries()].find(([, frequency]) => frequency === modeFrequency)?.[0] ?? 0;
    const score = modeFrequency * 1_000 + modeCount;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function findZipEnd(view: DataView) {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (
      view.getUint32(offset, true) === ZIP_END_SIGNATURE &&
      offset + 22 + view.getUint16(offset + 20, true) === view.byteLength
    ) {
      return offset;
    }
  }
  fail("XLSX_INVALID_ARCHIVE", "XLSX ZIP end record is missing.");
}

function normalizeZipPath(value: string) {
  const parts: string[] = [];
  for (const segment of value.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) {
        fail("XLSX_INVALID_ARCHIVE", "XLSX contains an unsafe archive path.");
      }
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

function readZipDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 22) fail("XLSX_INVALID_ARCHIVE", "XLSX archive is too small.");

  const endOffset = findZipEnd(view);
  const diskNumber = view.getUint16(endOffset + 4, true);
  const centralDisk = view.getUint16(endOffset + 6, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const totalEntries = view.getUint16(endOffset + 10, true);
  const centralSize = view.getUint32(endOffset + 12, true);
  const centralOffset = view.getUint32(endOffset + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    fail("XLSX_UNSUPPORTED_ARCHIVE", "Multi-disk XLSX archives are not supported.");
  }
  if (totalEntries === 0xffff) {
    fail("XLSX_UNSUPPORTED_ARCHIVE", "ZIP64 XLSX files are not supported for browser parsing.");
  }
  if (totalEntries > TRANSACTION_SOURCE_LIMITS.maxZipEntries) {
    fail("XLSX_TOO_LARGE", "XLSX contains too many archive entries.");
  }
  if (centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    fail("XLSX_UNSUPPORTED_ARCHIVE", "ZIP64 XLSX files are not supported for browser parsing.");
  }
  if (centralOffset + centralSize > view.byteLength) {
    fail("XLSX_INVALID_ARCHIVE", "XLSX central directory is outside the file boundary.");
  }

  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (
      offset + 46 > view.byteLength ||
      view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      fail("XLSX_INVALID_ARCHIVE", "XLSX central directory entry is malformed.");
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

    if (recordEnd > view.byteLength) {
      fail("XLSX_INVALID_ARCHIVE", "XLSX entry exceeds file boundary.");
    }
    if ((flags & 0x0001) !== 0) {
      fail("XLSX_UNSUPPORTED_ARCHIVE", "Encrypted XLSX files are not supported.");
    }
    if (![0, 8].includes(compressionMethod)) {
      fail("XLSX_UNSUPPORTED_ARCHIVE", "XLSX uses an unsupported ZIP compression method.");
    }
    if ([compressedSize, uncompressedSize, localHeaderOffset].includes(0xffffffff)) {
      fail("XLSX_UNSUPPORTED_ARCHIVE", "ZIP64 XLSX files are not supported for browser parsing.");
    }

    const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
    const name = normalizeZipPath(UTF8_LENIENT.decode(nameBytes));
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > TRANSACTION_SOURCE_LIMITS.maxXlsxUncompressedBytes) {
      fail("XLSX_TOO_LARGE", "XLSX expands beyond the safe browser limit.");
    }

    entries.set(name, {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = recordEnd;
  }

  return entries;
}

async function inflateRaw(bytes: Uint8Array, expectedSize: number) {
  try {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    const stream = new Blob([ownedBytes.buffer])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > expectedSize || total > TRANSACTION_SOURCE_LIMITS.maxXlsxUncompressedBytes) {
        await reader.cancel();
        fail("XLSX_TOO_LARGE", "XLSX entry expands beyond its declared safe size.");
      }

      const ownedChunk = new Uint8Array(value.byteLength);
      ownedChunk.set(value);
      chunks.push(ownedChunk);
    }

    if (total !== expectedSize) {
      fail("XLSX_INVALID_ARCHIVE", "XLSX entry size does not match its ZIP metadata.");
    }

    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  } catch (error) {
    if (error instanceof TransactionSourceParseError) throw error;
    fail("XLSX_INVALID_ARCHIVE", "XLSX compressed data could not be decompressed.");
  }
}

async function extractZipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > view.byteLength || view.getUint32(offset, true) !== ZIP_LOCAL_FILE_SIGNATURE) {
    fail("XLSX_INVALID_ARCHIVE", `XLSX local header is missing for ${entry.name}.`);
  }

  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataEnd > view.byteLength) {
    fail("XLSX_INVALID_ARCHIVE", "XLSX compressed entry exceeds file boundary.");
  }

  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
  if (entry.compressionMethod === 8) {
    return inflateRaw(compressed, entry.uncompressedSize);
  }

  if (entry.compressedSize !== entry.uncompressedSize) {
    fail("XLSX_INVALID_ARCHIVE", "Stored XLSX entry has inconsistent size metadata.");
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
    fail("XLSX_INVALID_ARCHIVE", `XLSX XML is not valid UTF-8: ${path}.`);
  }
}

function firstWorksheet(workbookXml: string, relationshipsXml: string) {
  const sheetTag = workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/i)?.[0];
  if (!sheetTag) fail("XLSX_SHEET_MISSING", "XLSX workbook has no worksheet.");

  const sheetName = attributeValue(sheetTag, "name") ?? "Sheet 1";
  const relationshipId = attributeValue(sheetTag, "r:id") ?? namespacedIdValue(sheetTag);
  if (!relationshipId) {
    fail("XLSX_INVALID_ARCHIVE", "XLSX worksheet relationship is missing.");
  }

  const relationshipTags =
    relationshipsXml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*\/?\s*>/gi) ?? [];
  const relationshipTag = relationshipTags.find(
    (tag) => attributeValue(tag, "Id") === relationshipId,
  );
  const target = relationshipTag ? attributeValue(relationshipTag, "Target") : null;
  if (!target) fail("XLSX_SHEET_MISSING", "XLSX worksheet target is missing.");

  return { sheetName, worksheetPath: resolveZipPath("xl/workbook.xml", target) };
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [];
  const values: string[] = [];
  const itemPattern =
    /<(?:[A-Za-z_][\w.-]*:)?si\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?si>/gi;

  for (const itemMatch of xml.matchAll(itemPattern)) {
    const fragments: string[] = [];
    const textPattern =
      /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi;
    for (const textMatch of itemMatch[1].matchAll(textPattern)) {
      fragments.push(decodeXmlText(textMatch[1]));
    }
    values.push(fragments.join(""));
  }

  return values;
}

function customFormatLooksLikeDate(formatCode: string) {
  const withoutLiterals = formatCode.replace(/"[^"]*"/g, "").replace(/\\./g, "");
  const hasElapsedTime = /\[(?:h+|m+|s+)\]/i.test(withoutLiterals);
  const stripped = withoutLiterals
    .replace(/\[[^\]]*]/g, "")
    .replace(/_.|\*./g, "")
    .toLowerCase();

  if (/[yd]/.test(stripped)) return true;
  if (hasElapsedTime || /[hs]/.test(stripped)) return false;
  return /m/.test(stripped);
}

function parseStyles(xml: string | null): XlsxStyles {
  const dateFormatIds = new Set(BUILTIN_DATE_FORMAT_IDS);
  if (!xml) return { dateStyleIndexes: new Set() };

  const customFormats =
    xml.match(/<(?:[A-Za-z_][\w.-]*:)?numFmt\b(?:[^>"']|"[^"]*"|'[^']*')*\/?\s*>/gi) ?? [];
  for (const tag of customFormats) {
    const id = Number(attributeValue(tag, "numFmtId"));
    const code = attributeValue(tag, "formatCode");
    if (Number.isInteger(id) && code && customFormatLooksLikeDate(code)) dateFormatIds.add(id);
  }

  const cellXfs = xml.match(
    /<(?:[A-Za-z_][\w.-]*:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?cellXfs>/i,
  )?.[1];
  const dateStyleIndexes = new Set<number>();
  if (!cellXfs) return { dateStyleIndexes };

  const xfTags = cellXfs.match(/<(?:[A-Za-z_][\w.-]*:)?xf\b[^>]*\/?\s*>/gi) ?? [];
  xfTags.forEach((tag, index) => {
    const numFmtId = Number(attributeValue(tag, "numFmtId") ?? 0);
    if (dateFormatIds.has(numFmtId)) dateStyleIndexes.add(index);
  });
  return { dateStyleIndexes };
}

export function columnIndexFromReference(reference: string | null) {
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
  if (!date1904 && wholeDays === 60) return serialText;
  const fraction = serial - wholeDays;

  const adjustedDays = date1904 ? wholeDays : wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const millis = epoch + adjustedDays * 86_400_000 + Math.round(fraction * 86_400_000);
  const date = new Date(millis);
  if (!Number.isFinite(date.getTime())) return serialText;

  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z")
    ? iso.slice(0, 10)
    : iso.replace("T", " ").replace(/\.000Z$/, "Z");
}

function textFragments(xml: string) {
  const fragments: string[] = [];
  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/gi;
  for (const match of xml.matchAll(pattern)) fragments.push(decodeXmlText(match[1]));
  return fragments.join("");
}

export function cellDisplayValue(
  tag: string,
  body: string,
  sharedStrings: string[],
  styles: XlsxStyles,
  date1904: boolean,
) {
  const type = attributeValue(tag, "t");
  if (type === "inlineStr") return textFragments(body);

  const rawValue = body.match(
    /<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>/i,
  )?.[1];
  if (rawValue === undefined) return textFragments(body);

  const value = decodeXmlText(rawValue);
  if (type === "s") {
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 ? (sharedStrings[index] ?? "") : "";
  }
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  if (type === "str" || type === "e" || type === "d") return value;

  const styleIndex = Number(attributeValue(tag, "s") ?? -1);
  if (Number.isInteger(styleIndex) && styles.dateStyleIndexes.has(styleIndex)) {
    return excelDateString(value, date1904);
  }
  return value;
}

export async function readFirstXlsxWorksheet(buffer: ArrayBuffer): Promise<FirstXlsxWorksheet> {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    fail("XLSX_INVALID_ARCHIVE", "XLSX does not contain a ZIP file signature.");
  }

  const entries = readZipDirectory(buffer);
  const workbookXml = await extractZipText(buffer, entries, "xl/workbook.xml");
  const relationshipsXml = await extractZipText(buffer, entries, "xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relationshipsXml) {
    fail("XLSX_WORKBOOK_MISSING", "XLSX workbook metadata is missing.");
  }

  const { sheetName, worksheetPath } = firstWorksheet(workbookXml, relationshipsXml);
  const worksheetXml = await extractZipText(buffer, entries, worksheetPath);
  if (!worksheetXml) fail("XLSX_SHEET_MISSING", "The first XLSX worksheet could not be found.");

  const [sharedStringsXml, stylesXml] = await Promise.all([
    extractZipText(buffer, entries, "xl/sharedStrings.xml"),
    extractZipText(buffer, entries, "xl/styles.xml"),
  ]);
  const date1904 =
    /<(?:[A-Za-z_][\w.-]*:)?workbookPr\b[^>]*date1904\s*=\s*(?:"(?:1|true)"|'(?:1|true)')/i.test(
      workbookXml,
    );

  return {
    sheetName,
    worksheetXml,
    sharedStrings: parseSharedStrings(sharedStringsXml),
    styles: parseStyles(stylesXml),
    date1904,
  };
}
