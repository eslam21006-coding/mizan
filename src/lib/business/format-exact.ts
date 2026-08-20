import type { ExactRatio } from "./calculations";

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

function normalize(value: Rational): Rational {
  if (value.denominator === 0n) throw new Error("Formatting denominator cannot be zero.");
  const sign = value.denominator < 0n ? -1n : 1n;
  return {
    numerator: value.numerator * sign,
    denominator: value.denominator * sign,
  };
}

function decimalRational(value: string): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) throw new Error("Exact decimal value is invalid.");

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  return normalize({ numerator, denominator });
}

function ratioRational(value: ExactRatio): Rational {
  return normalize({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
}

function localizeDigits(value: string) {
  return value.replace(/\d/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
}

function formatRational(
  input: Rational,
  maximumFractionDigits: number,
  multiplier = 1n,
) {
  if (!Number.isInteger(maximumFractionDigits) || maximumFractionDigits < 0 || maximumFractionDigits > 8) {
    throw new Error("maximumFractionDigits must be an integer from 0 to 8.");
  }

  const value = normalize(input);
  const negative = value.numerator < 0n;
  const absoluteNumerator = negative ? -value.numerator : value.numerator;
  const scale = 10n ** BigInt(maximumFractionDigits);
  const scaledNumerator = absoluteNumerator * multiplier * scale;
  const quotient = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  const rounded = quotient + (remainder * 2n >= value.denominator ? 1n : 0n);

  const integerPart = rounded / scale;
  const fractionalPart = maximumFractionDigits === 0 ? 0n : rounded % scale;
  const groupedInteger = localizeDigits(groupInteger(integerPart.toString()));

  if (maximumFractionDigits === 0 || fractionalPart === 0n) {
    return `${negative && rounded !== 0n ? "-" : ""}${groupedInteger}`;
  }

  const fraction = fractionalPart
    .toString()
    .padStart(maximumFractionDigits, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${groupedInteger}٫${localizeDigits(fraction)}`;
}

export function formatArabicExactDecimal(value: string, maximumFractionDigits = 2) {
  return formatRational(decimalRational(value), maximumFractionDigits);
}

export function formatArabicExactRatio(value: ExactRatio, maximumFractionDigits = 2) {
  return formatRational(ratioRational(value), maximumFractionDigits);
}

export function formatArabicExactPercent(value: ExactRatio, maximumFractionDigits = 1) {
  return formatRational(ratioRational(value), maximumFractionDigits, 100n);
}
