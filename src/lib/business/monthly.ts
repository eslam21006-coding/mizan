export const CUSTOMER_COUNT_BASES = ["new_customers", "total_paying_customers"] as const;

export type CustomerCountBasis = (typeof CUSTOMER_COUNT_BASES)[number];

export type ParsedInput<T> =
  | { ok: true; value: T }
  | { ok: false; value: null };

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeLocalizedDigits(value: string) {
  return [...value]
    .map((character) => {
      const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(character);
      if (easternIndex >= 0) return String(easternIndex);
      return character;
    })
    .join("");
}

function normalizeDecimalText(raw: string, maximumFractionDigits: number) {
  if (raw.includes(",")) return null;
  const pattern = new RegExp(`^\\d{1,16}(?:\\.\\d{1,${maximumFractionDigits}})?$`);
  if (!pattern.test(raw)) return null;

  const [integerPart, fractionalPart] = raw.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fractionalPart?.replace(/0+$/, "") ?? "";
  return normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger;
}

function normalizeSignedDecimalText(raw: string, maximumFractionDigits: number) {
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const normalized = normalizeDecimalText(unsigned, maximumFractionDigits);
  if (normalized === null) return null;
  if (normalized === "0") return "0";
  return negative ? `-${normalized}` : normalized;
}

function normalizedMoneyInput(value: unknown) {
  const localized = normalizeLocalizedDigits(String(value ?? "")).trim();
  if (
    localized.includes("٬") &&
    !/^-?\d{1,3}(?:٬\d{3})+(?:[٫.]\d+)?$/.test(localized)
  ) {
    return null;
  }

  return localized.replaceAll("٬", "").replaceAll("٫", ".");
}

export function parseOptionalDecimalInput(value: unknown): ParsedInput<string | null> {
  const raw = normalizedMoneyInput(value);
  if (raw === null) return { ok: false, value: null };
  if (raw.length === 0) return { ok: true, value: null };
  const normalized = normalizeDecimalText(raw, 8);
  return normalized === null ? { ok: false, value: null } : { ok: true, value: normalized };
}

export function parseOptionalSignedDecimalInput(value: unknown): ParsedInput<string | null> {
  const raw = normalizedMoneyInput(value);
  if (raw === null) return { ok: false, value: null };
  if (raw.length === 0) return { ok: true, value: null };
  const normalized = normalizeSignedDecimalText(raw, 8);
  return normalized === null ? { ok: false, value: null } : { ok: true, value: normalized };
}

export function parseOptionalCountInput(value: unknown): ParsedInput<number | null> {
  const raw = normalizeLocalizedDigits(String(value ?? "")).trim();
  if (raw.length === 0) return { ok: true, value: null };
  if (!/^\d+$/.test(raw)) return { ok: false, value: null };

  const parsed = BigInt(raw);
  if (parsed > 2_147_483_647n) return { ok: false, value: null };
  return { ok: true, value: Number(parsed) };
}

export function parseCustomerCountBasis(value: unknown): CustomerCountBasis | null {
  const candidate = String(value ?? "").trim();
  return CUSTOMER_COUNT_BASES.includes(candidate as CustomerCountBasis)
    ? (candidate as CustomerCountBasis)
    : null;
}

export function parseMonthKey(value: unknown) {
  const candidate = normalizeLocalizedDigits(String(value ?? "")).trim();
  const match = /^(\d{4})-(\d{2})$/.exec(candidate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) return null;

  return {
    monthKey: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`,
    monthStart: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
  };
}

export function shiftMonthKey(monthKey: string, offset: number) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed || !Number.isInteger(offset)) return null;

  const [year, month] = parsed.monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKeyForTimeZone(timeZone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7);
  } catch (error) {
    if (error instanceof RangeError) return now.toISOString().slice(0, 7);
    throw error;
  }
}

function shiftStoredDecimalRight(value: string, places: number) {
  const parsed = normalizeDecimalText(value.trim(), 12);
  if (parsed === null) return "";

  const [whole, fraction = ""] = parsed.split(".");
  const digits = `${whole}${fraction}`;
  const currentScale = fraction.length;
  const targetScale = currentScale - places;

  if (targetScale <= 0) return `${digits}${"0".repeat(-targetScale)}`.replace(/^0+(?=\d)/, "");

  const padded = digits.padStart(targetScale + 1, "0");
  const splitAt = padded.length - targetScale;
  const result = `${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
  return result.replace(/^0+(?=\d)/, "").replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function storedExpenseValueForDisplay(
  value: string | number | null | undefined,
  behavior: string,
) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value);
  return behavior === "percentage_revenue" ? shiftStoredDecimalRight(text, 2) : text;
}

export function normalizeAdjustmentNote(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length <= 500 ? normalized : null;
}
