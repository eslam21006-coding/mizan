import type { ExactRatio } from "./calculations.ts";

export type Rational = {
  numerator: bigint;
  denominator: bigint;
};

export const ZERO_RATIONAL: Rational = { numerator: 0n, denominator: 1n };
export const ONE_RATIONAL: Rational = { numerator: 1n, denominator: 1n };

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

/** Returns the greatest common divisor used to reduce exact rational values. */
function gcd(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

/** Normalizes a rational to a positive denominator and lowest terms. */
export function normalizeRational(value: Rational): Rational {
  if (value.denominator === 0n) {
    throw new Error("Exact rational denominator cannot be zero.");
  }
  if (value.numerator === 0n) return ZERO_RATIONAL;

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/** Parses a canonical decimal string into an exact rational without floating-point conversion. */
export function rationalFromDecimalString(value: string): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new Error("Exact decimal must be a canonical decimal string.");
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const magnitude = BigInt(`${whole}${fraction}` || "0");

  return normalizeRational({
    numerator: negative ? -magnitude : magnitude,
    denominator: 10n ** BigInt(fraction.length),
  });
}

/** Returns the exact absolute value of a rational. */
export function absoluteRational(value: Rational): Rational {
  const normalized = normalizeRational(value);
  return normalized.numerator < 0n
    ? { numerator: -normalized.numerator, denominator: normalized.denominator }
    : normalized;
}

/** Converts an internal rational into the serialized ExactRatio contract. */
export function exactRatioFromRational(value: Rational): ExactRatio {
  const normalized = normalizeRational(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

/** Converts a serialized ExactRatio into a normalized internal rational. */
export function rationalFromExactRatio(value: ExactRatio): Rational {
  return normalizeRational({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
}

/** Adds two rational values exactly. */
export function addRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

/** Subtracts the right rational from the left exactly. */
export function subtractRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

/** Multiplies two rational values exactly. */
export function multiplyRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

/** Divides the left rational by a non-zero right rational exactly. */
export function divideRationals(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new Error("Exact rational division by zero is not allowed.");
  }
  return normalizeRational({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

/** Compares two rational values and returns -1, 0, or 1. */
export function compareRationals(left: Rational, right: Rational) {
  const normalizedLeft = normalizeRational(left);
  const normalizedRight = normalizeRational(right);
  const scaledLeft = normalizedLeft.numerator * normalizedRight.denominator;
  const scaledRight = normalizedRight.numerator * normalizedLeft.denominator;
  return scaledLeft === scaledRight ? 0 : scaledLeft > scaledRight ? 1 : -1;
}

/** Subtracts two serialized exact ratios while preserving exact arithmetic. */
export function subtractExactRatios(left: ExactRatio, right: ExactRatio): ExactRatio {
  return exactRatioFromRational(
    subtractRationals(rationalFromExactRatio(left), rationalFromExactRatio(right)),
  );
}
