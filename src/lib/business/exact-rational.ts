import type { ExactRatio } from "./calculations.ts";

export type Rational = {
  numerator: bigint;
  denominator: bigint;
};

export const ZERO_RATIONAL: Rational = { numerator: 0n, denominator: 1n };
export const ONE_RATIONAL: Rational = { numerator: 1n, denominator: 1n };

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

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

export function absoluteRational(value: Rational): Rational {
  const normalized = normalizeRational(value);
  return normalized.numerator < 0n
    ? { numerator: -normalized.numerator, denominator: normalized.denominator }
    : normalized;
}

export function exactRatioFromRational(value: Rational): ExactRatio {
  const normalized = normalizeRational(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

export function rationalFromExactRatio(value: ExactRatio): Rational {
  return normalizeRational({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
}

export function addRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function subtractRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function multiplyRationals(left: Rational, right: Rational): Rational {
  return normalizeRational({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

export function divideRationals(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new Error("Exact rational division by zero is not allowed.");
  }
  return normalizeRational({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

export function compareRationals(left: Rational, right: Rational) {
  const normalizedLeft = normalizeRational(left);
  const normalizedRight = normalizeRational(right);
  const scaledLeft = normalizedLeft.numerator * normalizedRight.denominator;
  const scaledRight = normalizedRight.numerator * normalizedLeft.denominator;
  return scaledLeft === scaledRight ? 0 : scaledLeft > scaledRight ? 1 : -1;
}

export function subtractExactRatios(left: ExactRatio, right: ExactRatio): ExactRatio {
  return exactRatioFromRational(
    subtractRationals(rationalFromExactRatio(left), rationalFromExactRatio(right)),
  );
}
