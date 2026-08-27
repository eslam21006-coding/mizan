import type { ExactRatio } from "./calculations.ts";

export type Rational = {
  numerator: bigint;
  denominator: bigint;
};

export const ZERO_RATIONAL: Rational = { numerator: 0n, denominator: 1n };
export const ONE_RATIONAL: Rational = { numerator: 1n, denominator: 1n };

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
  const scaledLeft = left.numerator * right.denominator;
  const scaledRight = right.numerator * left.denominator;
  return scaledLeft === scaledRight ? 0 : scaledLeft > scaledRight ? 1 : -1;
}

export function subtractExactRatios(left: ExactRatio, right: ExactRatio): ExactRatio {
  return exactRatioFromRational(
    subtractRationals(rationalFromExactRatio(left), rationalFromExactRatio(right)),
  );
}
