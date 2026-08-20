import type { CalculatedMetric, ExactRatio } from "./calculations";

export type ComparisonDirection = "up" | "down" | "flat";
export type ComparisonUnavailableReason = "CURRENT_UNAVAILABLE" | "PREVIOUS_UNAVAILABLE";

export type MetricComparison =
  | {
      available: true;
      direction: ComparisonDirection;
      change: ExactRatio;
      relativeChange: ExactRatio | null;
    }
  | {
      available: false;
      reason: ComparisonUnavailableReason;
    };

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

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

function normalize(value: Rational): Rational {
  if (value.denominator === 0n) throw new Error("Comparison denominator cannot be zero.");
  if (value.numerator === 0n) return { numerator: 0n, denominator: 1n };

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function powerOfTen(exponent: number) {
  return 10n ** BigInt(exponent);
}

function decimalRational(value: string): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) throw new Error("Comparison value must be a canonical decimal.");

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const numerator = BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n);
  return normalize({ numerator, denominator: powerOfTen(fraction.length) });
}

function ratioRational(value: ExactRatio): Rational {
  return normalize({ numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) });
}

function subtract(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) throw new Error("Cannot divide comparison values by zero.");
  return normalize({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

function absolute(value: Rational): Rational {
  return { numerator: value.numerator < 0n ? -value.numerator : value.numerator, denominator: value.denominator };
}

function exactRatio(value: Rational): ExactRatio {
  const normalized = normalize(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

function compareAvailable(current: Rational, previous: Rational): MetricComparison {
  const change = subtract(current, previous);
  const direction: ComparisonDirection =
    change.numerator === 0n ? "flat" : change.numerator > 0n ? "up" : "down";

  return {
    available: true,
    direction,
    change: exactRatio(change),
    relativeChange:
      previous.numerator === 0n ? null : exactRatio(divide(change, absolute(previous))),
  };
}

function compareMetrics<T>(
  current: CalculatedMetric<T>,
  previous: CalculatedMetric<T>,
  toRational: (value: T) => Rational,
): MetricComparison {
  if (!current.available) return { available: false, reason: "CURRENT_UNAVAILABLE" };
  if (!previous.available) return { available: false, reason: "PREVIOUS_UNAVAILABLE" };
  return compareAvailable(toRational(current.value), toRational(previous.value));
}

export function compareDecimalMetrics(
  current: CalculatedMetric<string>,
  previous: CalculatedMetric<string>,
) {
  return compareMetrics(current, previous, decimalRational);
}

export function compareCountMetrics(
  current: CalculatedMetric<number>,
  previous: CalculatedMetric<number>,
) {
  return compareMetrics(current, previous, (value) => ({ numerator: BigInt(value), denominator: 1n }));
}

export function compareRatioMetrics(
  current: CalculatedMetric<ExactRatio>,
  previous: CalculatedMetric<ExactRatio>,
) {
  return compareMetrics(current, previous, ratioRational);
}
