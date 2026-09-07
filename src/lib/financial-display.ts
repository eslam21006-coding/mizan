const DECIMAL_TEXT = /^([+-]?)(\d+)(?:\.(\d+))?$/;
const INTEGER_TEXT = /^(?:0|[1-9]\d*)$/;

/** Adds thousands separators to a normalized integer digit string without numeric coercion. */
function groupedInteger(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Removes redundant leading zeroes while preserving an exact zero value. */
function trimLeadingZeros(digits: string) {
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  return trimmed || "0";
}

/** Formats an exact decimal string for UI display without converting it through JavaScript Number. */
export function formatFinancialDecimal(value: string, maximumFractionDigits = 2) {
  if (!Number.isSafeInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 12) {
    throw new RangeError("maximumFractionDigits must be an integer between 0 and 12.");
  }

  const normalized = value.trim();
  const match = normalized.match(DECIMAL_TEXT);
  if (!match) return normalized;

  const negative = match[1] === "-";
  let integer = trimLeadingZeros(match[2]);
  const sourceFraction = match[3] ?? "";
  let fraction = sourceFraction.slice(0, maximumFractionDigits);

  if (sourceFraction.length > maximumFractionDigits) {
    const roundingDigit = Number(sourceFraction[maximumFractionDigits]);
    if (roundingDigit >= 5) {
      if (maximumFractionDigits === 0) {
        integer = (BigInt(integer) + 1n).toString();
      } else {
        const scale = 10n ** BigInt(maximumFractionDigits);
        const fractionalUnits = BigInt(fraction.padEnd(maximumFractionDigits, "0") || "0");
        const roundedUnits = BigInt(integer) * scale + fractionalUnits + 1n;
        integer = (roundedUnits / scale).toString();
        fraction = (roundedUnits % scale).toString().padStart(maximumFractionDigits, "0");
      }
    }
  }

  fraction = fraction.replace(/0+$/, "");
  const isZero = integer === "0" && fraction.length === 0;
  const sign = negative && !isZero ? "-" : "";
  return `${sign}${groupedInteger(integer)}${fraction ? `.${fraction}` : ""}`;
}

/** Adds thousands separators to an exact non-negative integer count. */
export function formatCountText(value: string | number) {
  const normalized = String(value).trim();
  if (!INTEGER_TEXT.test(normalized)) return normalized;
  return groupedInteger(trimLeadingZeros(normalized));
}

/** Formats an exact monetary text value with currency while preserving calculation precision upstream. */
export function formatMoneyText(value: string, currency: string) {
  return `${formatFinancialDecimal(value)} ${currency}`;
}

/** Returns a whole-number percentage for one exact count divided by another. */
export function formatCountRatioPercent(numeratorText: string, denominatorText: string) {
  if (!INTEGER_TEXT.test(numeratorText) || !INTEGER_TEXT.test(denominatorText)) return null;
  const numerator = BigInt(numeratorText);
  const denominator = BigInt(denominatorText);
  if (denominator === 0n || numerator > denominator) return null;
  const roundedPercent = (numerator * 100n + denominator / 2n) / denominator;
  return `${roundedPercent}%`;
}
