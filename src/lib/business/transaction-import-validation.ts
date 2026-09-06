export const TRANSACTION_VALIDATION_ERROR_SAMPLE_LIMIT = 25;
export const TRANSACTION_EMAIL_MAX_LENGTH = 320;
export const TRANSACTION_ID_MAX_LENGTH = 512;

export const TRANSACTION_VALIDATION_FIELDS = [
  "customerEmail",
  "transactionDate",
  "transactionTime",
  "timezone",
  "amountCollected",
  "transactionId",
  "currency",
] as const;

export type TransactionValidationField = (typeof TRANSACTION_VALIDATION_FIELDS)[number];

export type TransactionValidationInputRow = {
  rowNumber: number;
  customerEmail: string;
  transactionDate: string;
  transactionTime?: string;
  timezone?: string;
  amountCollected: string;
  transactionId?: string;
  currency?: string;
};

export type TransactionValidationIssueCode =
  | "EMAIL_REQUIRED"
  | "EMAIL_INVALID"
  | "TRANSACTION_DATE_REQUIRED"
  | "TRANSACTION_DATE_INVALID"
  | "TRANSACTION_TIME_REQUIRED"
  | "TRANSACTION_TIME_INVALID"
  | "TIMEZONE_REQUIRED"
  | "TIMEZONE_INVALID"
  | "AMOUNT_REQUIRED"
  | "AMOUNT_INVALID"
  | "TRANSACTION_ID_TOO_LONG"
  | "CURRENCY_REQUIRED"
  | "CURRENCY_MISMATCH";

export type TransactionValidationIssue = {
  rowNumber: number;
  field: TransactionValidationField;
  code: TransactionValidationIssueCode;
  rawValue: string;
};

export type TransactionImportValidationResult = {
  totalSourceRows: number;
  checkedRows: number;
  validRows: number;
  invalidRows: number;
  skippedHeaderRows: number;
  collapsedSourceRows: number;
  ignoredNonCashRows: number;
  ignoredNonCashTransactions: number;
  issueCount: number;
  issues: TransactionValidationIssue[];
  issuesTruncated: boolean;
  isValid: boolean;
};

export type GatewayTransactionNormalizationResult = {
  rows: TransactionValidationInputRow[];
  skippedHeaderRows: number;
  collapsedSourceRows: number;
  ignoredNonCashRows: number;
  ignoredNonCashTransactions: number;
};

type TransactionGroupConflictField =
  | "customerEmail"
  | "transactionDate"
  | "transactionTime"
  | "timezone"
  | "amountCollected"
  | "currency";

type TimeParts = { hour: number; minute: number; second: number };
type DateParts = { year: number; month: number; day: number };
type DateTimeParts = DateParts & TimeParts;

export class TransactionGatewayNormalizationError extends Error {
  readonly transactionId: string;
  readonly field: TransactionGroupConflictField;
  readonly rowNumbers: number[];

  constructor(transactionId: string, field: TransactionGroupConflictField, rowNumbers: number[]) {
    super(`Conflicting ${field} values for transaction ${transactionId}.`);
    this.name = "TransactionGatewayNormalizationError";
    this.transactionId = transactionId;
    this.field = field;
    this.rowNumbers = rowNumbers;
  }
}

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const GATEWAY_DATE_PATTERN = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/;
const TIME_12_HOUR_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i;
const TIME_24_HOUR_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const DECIMAL_AMOUNT_PATTERN =
  /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const GATEWAY_MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const timezoneFormatters = new Map<string, Intl.DateTimeFormat>();

function unicodeCharacterLength(value: string) {
  return Array.from(value).length;
}

export function normalizeTransactionEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidTransactionEmail(value: string) {
  const normalized = normalizeTransactionEmail(value);
  if (
    !normalized ||
    unicodeCharacterLength(normalized) > TRANSACTION_EMAIL_MAX_LENGTH ||
    !BASIC_EMAIL_PATTERN.test(normalized)
  ) {
    return false;
  }
  const firstAt = normalized.indexOf("@");
  return firstAt > 0 && firstAt === normalized.lastIndexOf("@") && firstAt < normalized.length - 1;
}

function isRealCalendarDate(year: number, month: number, day: number) {
  if (year < 1) return false;
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function twoDigitGatewayYear(year: number) {
  return 2000 + year;
}

/** Normalizes a date-only or already-combined ISO timestamp from a gateway export. */
export function normalizeTransactionDateForImport(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const dateOnly = normalized.match(ISO_DATE_PATTERN);
  if (dateOnly) {
    return isRealCalendarDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]))
      ? normalized
      : null;
  }

  const dateTime = normalized.match(ISO_DATE_TIME_PATTERN);
  if (dateTime) {
    if (!isRealCalendarDate(Number(dateTime[1]), Number(dateTime[2]), Number(dateTime[3]))) {
      return null;
    }

    const hours = Number(dateTime[4]);
    const minutes = Number(dateTime[5]);
    const seconds = dateTime[6] === undefined ? 0 : Number(dateTime[6]);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;

    const offsetMatch = normalized.match(/([+-])(\d{2}):(\d{2})$/);
    if (offsetMatch) {
      const offsetHours = Number(offsetMatch[2]);
      const offsetMinutes = Number(offsetMatch[3]);
      if (offsetHours > 23 || offsetMinutes > 59) return null;
    }
    return normalized;
  }

  const gatewayDate = normalized.match(GATEWAY_DATE_PATTERN);
  if (!gatewayDate) return null;
  const month = GATEWAY_MONTHS[gatewayDate[2].toLowerCase()];
  if (!month) return null;
  const rawYear = Number(gatewayDate[3]);
  const year = gatewayDate[3].length === 2 ? twoDigitGatewayYear(rawYear) : rawYear;
  const day = Number(gatewayDate[1]);
  if (!isRealCalendarDate(year, month, day)) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidTransactionDate(value: string) {
  return normalizeTransactionDateForImport(value) !== null;
}

/** Parses 12-hour or 24-hour gateway clock text into a canonical wall-clock value. */
export function parseTransactionTime(value: string): TimeParts | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const twelveHour = normalized.match(TIME_12_HOUR_PATTERN);
  if (twelveHour) {
    const rawHour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    const second = twelveHour[3] === undefined ? 0 : Number(twelveHour[3]);
    if (rawHour < 1 || rawHour > 12 || minute > 59 || second > 59) return null;
    const isPm = twelveHour[4].toUpperCase() === "PM";
    const hour = rawHour === 12 ? (isPm ? 12 : 0) : rawHour + (isPm ? 12 : 0);
    return { hour, minute, second };
  }

  const twentyFourHour = normalized.match(TIME_24_HOUR_PATTERN);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  const second = twentyFourHour[3] === undefined ? 0 : Number(twentyFourHour[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function canonicalTime(value: string) {
  const parsed = parseTransactionTime(value);
  if (!parsed) return null;
  return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}:${String(parsed.second).padStart(2, "0")}`;
}

/** Returns the runtime-canonical IANA time zone name, or null when the zone is unknown. */
export function normalizeTransactionTimezone(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: normalized }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function timezoneFormatter(timezone: string) {
  const cached = timezoneFormatters.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  timezoneFormatters.set(timezone, formatter);
  return formatter;
}

function partsInTimezone(timestamp: number, timezone: string): DateTimeParts | null {
  const values = new Map(
    timezoneFormatter(timezone)
      .formatToParts(new Date(timestamp))
      .flatMap((part) =>
        ["year", "month", "day", "hour", "minute", "second"].includes(part.type)
          ? [[part.type, Number(part.value)] as const]
          : [],
      ),
  );
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  const hour = values.get("hour");
  const minute = values.get("minute");
  const second = values.get("second");
  if ([year, month, day, hour, minute, second].some((part) => part === undefined)) return null;
  return {
    year: year as number,
    month: month as number,
    day: day as number,
    hour: hour as number,
    minute: minute as number,
    second: second as number,
  };
}

function utcWallClock(parts: DateTimeParts) {
  const value = new Date(0);
  value.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return value.getTime();
}

function sameDateTimeParts(left: DateTimeParts | null, right: DateTimeParts) {
  return (
    left !== null &&
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function timezoneOffsetAt(timestamp: number, timezone: string) {
  const local = partsInTimezone(timestamp, timezone);
  return local ? utcWallClock(local) - timestamp : null;
}

/**
 * Combines separate gateway Date + Time + IANA Timezone columns into one UTC ISO timestamp.
 * Nonexistent or DST-ambiguous wall-clock times are rejected instead of guessed.
 */
export function normalizeTransactionDateTimeForImport(
  dateValue: string,
  timeValue?: string,
  timezoneValue?: string,
) {
  const time = timeValue?.trim() ?? "";
  const timezoneText = timezoneValue?.trim() ?? "";
  if (!time && !timezoneText) return normalizeTransactionDateForImport(dateValue);
  if (!time || !timezoneText) return null;

  const normalizedDate = normalizeTransactionDateForImport(dateValue);
  if (!normalizedDate || !ISO_DATE_PATTERN.test(normalizedDate)) return null;
  const parsedTime = parseTransactionTime(time);
  const timezone = normalizeTransactionTimezone(timezoneText);
  if (!parsedTime || !timezone) return null;

  const dateMatch = normalizedDate.match(ISO_DATE_PATTERN);
  if (!dateMatch) return null;
  const target: DateTimeParts = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    ...parsedTime,
  };
  const wallClock = utcWallClock(target);
  const initialOffset = timezoneOffsetAt(wallClock, timezone);
  if (initialOffset === null) return null;
  let candidate = wallClock - initialOffset;
  const resolvedOffset = timezoneOffsetAt(candidate, timezone);
  if (resolvedOffset === null) return null;
  candidate = wallClock - resolvedOffset;
  if (!sameDateTimeParts(partsInTimezone(candidate, timezone), target)) return null;

  const nearbyOffsets = new Set<number>();
  for (const delta of [-43_200_000, 43_200_000]) {
    const offset = timezoneOffsetAt(candidate + delta, timezone);
    if (offset !== null) nearbyOffsets.add(offset);
  }
  for (const offset of nearbyOffsets) {
    if (offset === resolvedOffset) continue;
    const alternative = wallClock - offset;
    if (alternative !== candidate && sameDateTimeParts(partsInTimezone(alternative, timezone), target)) {
      return null;
    }
  }

  return new Date(candidate).toISOString();
}

export function parseTransactionAmount(value: string) {
  const normalized = value.trim();
  if (!normalized || !DECIMAL_AMOUNT_PATTERN.test(normalized)) return null;
  const amount = Number(normalized.replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : null;
}

function canonicalDecimalKey(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  if (!normalized || !DECIMAL_AMOUNT_PATTERN.test(value.trim())) return `invalid:${normalized}`;

  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = normalized.replace(/^[+-]/, "");
  const [mantissa = "", exponentText] = unsigned.toLowerCase().split("e");
  const [integerPart = "", fractionPart = ""] = mantissa.split(".");
  let digits = `${integerPart}${fractionPart}`.replace(/^0+/, "");
  let exponent = (exponentText === undefined ? 0 : Number(exponentText)) - fractionPart.length;
  if (!digits || !/[1-9]/.test(digits)) return "0";

  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    exponent += 1;
  }
  return `${sign}${digits}e${exponent}`;
}

function groupedFieldValue(
  group: readonly TransactionValidationInputRow[],
  transactionId: string,
  field: TransactionGroupConflictField,
) {
  const values = new Map<string, string>();
  for (const row of group) {
    const raw =
      field === "currency"
        ? row.currency ?? ""
        : field === "customerEmail"
          ? row.customerEmail
          : field === "transactionDate"
            ? row.transactionDate
            : field === "transactionTime"
              ? row.transactionTime ?? ""
              : field === "timezone"
                ? row.timezone ?? ""
                : row.amountCollected;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let key: string;
    let output: string;
    if (field === "customerEmail") {
      output = normalizeTransactionEmail(trimmed);
      key = output;
    } else if (field === "transactionDate") {
      const canonicalDate = normalizeTransactionDateForImport(trimmed);
      output = canonicalDate ?? trimmed;
      key = canonicalDate ? `valid:${canonicalDate}` : `invalid:${trimmed}`;
    } else if (field === "transactionTime") {
      const canonical = canonicalTime(trimmed);
      output = canonical ?? trimmed;
      key = canonical ? `valid:${canonical}` : `invalid:${trimmed}`;
    } else if (field === "timezone") {
      const canonical = normalizeTransactionTimezone(trimmed);
      output = canonical ?? trimmed;
      key = canonical ? `valid:${canonical}` : `invalid:${trimmed}`;
    } else if (field === "amountCollected") {
      output = trimmed;
      key = canonicalDecimalKey(trimmed);
    } else {
      output = trimmed.toUpperCase();
      key = output;
    }
    if (!values.has(key)) values.set(key, output);
  }

  if (values.size > 1) {
    throw new TransactionGatewayNormalizationError(
      transactionId,
      field,
      group.map((row) => row.rowNumber),
    );
  }
  return values.values().next().value ?? "";
}

function normalizeTemporalRow(row: TransactionValidationInputRow): TransactionValidationInputRow {
  const canonical = normalizeTransactionDateTimeForImport(
    row.transactionDate,
    row.transactionTime,
    row.timezone,
  );
  return {
    ...row,
    transactionDate: canonical ?? row.transactionDate.trim(),
  };
}

export function normalizeGatewayTransactionRows(
  rows: readonly TransactionValidationInputRow[],
  options: { skipFirstRow?: boolean } = {},
): GatewayTransactionNormalizationResult {
  for (const row of rows) {
    if (!Number.isSafeInteger(row.rowNumber) || row.rowNumber < 1) {
      throw new RangeError("Transaction validation row numbers must be positive integers.");
    }
  }

  const sourceRows = options.skipFirstRow ? rows.slice(1) : [...rows];
  const skippedHeaderRows = options.skipFirstRow && rows.length > 0 ? 1 : 0;
  const groups = new Map<string, TransactionValidationInputRow[]>();
  const order: Array<
    | { kind: "group"; transactionId: string }
    | { kind: "row"; row: TransactionValidationInputRow }
  > = [];

  for (const row of sourceRows) {
    const transactionId = row.transactionId?.trim() ?? "";
    if (!transactionId) {
      order.push({ kind: "row", row });
      continue;
    }
    const existing = groups.get(transactionId);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(transactionId, [row]);
      order.push({ kind: "group", transactionId });
    }
  }

  const normalizedRows: TransactionValidationInputRow[] = [];
  let collapsedSourceRows = 0;
  let ignoredNonCashRows = 0;
  let ignoredNonCashTransactions = 0;

  for (const item of order) {
    if (item.kind === "row") {
      normalizedRows.push(normalizeTemporalRow(item.row));
      continue;
    }

    const group = groups.get(item.transactionId) ?? [];
    if (group.length === 0) continue;
    const amountCollected = groupedFieldValue(group, item.transactionId, "amountCollected");
    const amountKey = amountCollected ? canonicalDecimalKey(amountCollected) : "";
    if (!amountCollected || amountKey === "0") {
      ignoredNonCashRows += group.length;
      ignoredNonCashTransactions += 1;
      continue;
    }

    collapsedSourceRows += Math.max(0, group.length - 1);
    const currencyWasMapped = group.some((row) => row.currency !== undefined);
    const timeWasMapped = group.some((row) => row.transactionTime !== undefined);
    const timezoneWasMapped = group.some((row) => row.timezone !== undefined);
    normalizedRows.push(
      normalizeTemporalRow({
        rowNumber: group[0].rowNumber,
        customerEmail: groupedFieldValue(group, item.transactionId, "customerEmail"),
        transactionDate: groupedFieldValue(group, item.transactionId, "transactionDate"),
        transactionTime: timeWasMapped
          ? groupedFieldValue(group, item.transactionId, "transactionTime")
          : undefined,
        timezone: timezoneWasMapped
          ? groupedFieldValue(group, item.transactionId, "timezone")
          : undefined,
        amountCollected,
        transactionId: item.transactionId,
        currency: currencyWasMapped
          ? groupedFieldValue(group, item.transactionId, "currency")
          : undefined,
      }),
    );
  }

  return {
    rows: normalizedRows,
    skippedHeaderRows,
    collapsedSourceRows,
    ignoredNonCashRows,
    ignoredNonCashTransactions,
  };
}

function rowIssues(
  row: TransactionValidationInputRow,
  baseCurrency: string | undefined,
): TransactionValidationIssue[] {
  const issues: TransactionValidationIssue[] = [];
  const email = row.customerEmail.trim();
  const transactionDate = row.transactionDate.trim();
  const transactionTime = row.transactionTime?.trim() ?? "";
  const timezone = row.timezone?.trim() ?? "";
  const amountCollected = row.amountCollected.trim();
  const transactionId = row.transactionId?.trim() ?? "";

  if (!email) {
    issues.push({ rowNumber: row.rowNumber, field: "customerEmail", code: "EMAIL_REQUIRED", rawValue: row.customerEmail });
  } else if (!isValidTransactionEmail(email)) {
    issues.push({ rowNumber: row.rowNumber, field: "customerEmail", code: "EMAIL_INVALID", rawValue: row.customerEmail });
  }

  if (!transactionDate) {
    issues.push({ rowNumber: row.rowNumber, field: "transactionDate", code: "TRANSACTION_DATE_REQUIRED", rawValue: row.transactionDate });
  } else if (!isValidTransactionDate(transactionDate)) {
    issues.push({ rowNumber: row.rowNumber, field: "transactionDate", code: "TRANSACTION_DATE_INVALID", rawValue: row.transactionDate });
  }

  const temporalColumnsUsed = transactionTime !== "" || timezone !== "";
  if (temporalColumnsUsed) {
    if (!transactionTime) {
      issues.push({ rowNumber: row.rowNumber, field: "transactionTime", code: "TRANSACTION_TIME_REQUIRED", rawValue: row.transactionTime ?? "" });
    } else if (!parseTransactionTime(transactionTime)) {
      issues.push({ rowNumber: row.rowNumber, field: "transactionTime", code: "TRANSACTION_TIME_INVALID", rawValue: row.transactionTime ?? "" });
    }
    if (!timezone) {
      issues.push({ rowNumber: row.rowNumber, field: "timezone", code: "TIMEZONE_REQUIRED", rawValue: row.timezone ?? "" });
    } else if (!normalizeTransactionTimezone(timezone)) {
      issues.push({ rowNumber: row.rowNumber, field: "timezone", code: "TIMEZONE_INVALID", rawValue: row.timezone ?? "" });
    }
    if (
      ISO_DATE_PATTERN.test(transactionDate) &&
      transactionTime &&
      timezone &&
      parseTransactionTime(transactionTime) &&
      normalizeTransactionTimezone(timezone) &&
      normalizeTransactionDateTimeForImport(row.transactionDate, transactionTime, timezone) === null
    ) {
      issues.push({ rowNumber: row.rowNumber, field: "transactionTime", code: "TRANSACTION_TIME_INVALID", rawValue: row.transactionTime ?? "" });
    }
  }

  if (!amountCollected) {
    issues.push({ rowNumber: row.rowNumber, field: "amountCollected", code: "AMOUNT_REQUIRED", rawValue: row.amountCollected });
  } else if (parseTransactionAmount(amountCollected) === null) {
    issues.push({ rowNumber: row.rowNumber, field: "amountCollected", code: "AMOUNT_INVALID", rawValue: row.amountCollected });
  }

  if (transactionId && unicodeCharacterLength(transactionId) > TRANSACTION_ID_MAX_LENGTH) {
    issues.push({ rowNumber: row.rowNumber, field: "transactionId", code: "TRANSACTION_ID_TOO_LONG", rawValue: row.transactionId ?? "" });
  }

  if (row.currency !== undefined) {
    const currency = row.currency.trim().toUpperCase();
    if (!currency) {
      issues.push({ rowNumber: row.rowNumber, field: "currency", code: "CURRENCY_REQUIRED", rawValue: row.currency });
    } else if (!baseCurrency || currency !== baseCurrency.toUpperCase()) {
      issues.push({ rowNumber: row.rowNumber, field: "currency", code: "CURRENCY_MISMATCH", rawValue: row.currency });
    }
  }

  return issues;
}

export function validateTransactionImportRows(
  rows: readonly TransactionValidationInputRow[],
  options: { skipFirstRow?: boolean; issueSampleLimit?: number; baseCurrency?: string } = {},
): TransactionImportValidationResult {
  const issueSampleLimit = options.issueSampleLimit ?? TRANSACTION_VALIDATION_ERROR_SAMPLE_LIMIT;
  if (!Number.isSafeInteger(issueSampleLimit) || issueSampleLimit < 0) {
    throw new RangeError("Transaction validation issue sample limit must be a non-negative integer.");
  }

  const normalized = normalizeGatewayTransactionRows(rows, { skipFirstRow: options.skipFirstRow });
  let validRows = 0;
  let invalidRows = 0;
  let issueCount = 0;
  const issues: TransactionValidationIssue[] = [];

  for (const row of normalized.rows) {
    const currentIssues = rowIssues(row, options.baseCurrency);
    if (currentIssues.length === 0) {
      validRows += 1;
      continue;
    }
    invalidRows += 1;
    issueCount += currentIssues.length;
    for (const issue of currentIssues) {
      if (issues.length < issueSampleLimit) issues.push(issue);
    }
  }

  return {
    totalSourceRows: rows.length,
    checkedRows: normalized.rows.length,
    validRows,
    invalidRows,
    skippedHeaderRows: normalized.skippedHeaderRows,
    collapsedSourceRows: normalized.collapsedSourceRows,
    ignoredNonCashRows: normalized.ignoredNonCashRows,
    ignoredNonCashTransactions: normalized.ignoredNonCashTransactions,
    issueCount,
    issues,
    issuesTruncated: issueCount > issues.length,
    isValid: normalized.rows.length > 0 && invalidRows === 0,
  };
}
