import type { ExactRatio } from "./calculations.ts";

export type SustainableAcquisitionMetricUnavailableReason =
  | "NO_ACQUISITION_HEADROOM"
  | "NO_MEDIA_HEADROOM"
  | "MAX_MEDIA_CAC_UNAVAILABLE";

export type SustainableAcquisitionMetric<T> =
  | { available: true; value: T }
  | { available: false; reason: SustainableAcquisitionMetricUnavailableReason };

export type SustainableAcquisitionInput = {
  requiredRevenue: ExactRatio;
  requiredCustomers: number;
  requiredLeads: number;
  profitConstraintAmount: ExactRatio;
  monthlyFixedAcquisitionCosts: ExactRatio;
  monthlyFixedNonAcquisitionCosts: ExactRatio;
  variableNonMediaAcquisitionCostPerNewCustomer: ExactRatio;
  variableNonAcquisitionCostPerNewCustomer: ExactRatio;
};

export type SustainableAcquisitionResult = {
  projectedNonAcquisitionCosts: ExactRatio;
  mandatoryNonMediaAcquisitionCosts: ExactRatio;
  mandatoryNonMediaAcquisitionCostPerCustomer: ExactRatio;
  acquisitionBudgetHeadroom: ExactRatio;
  mediaBudgetHeadroom: ExactRatio;
  maximumSustainableAcquisitionCac: SustainableAcquisitionMetric<ExactRatio>;
  maximumMediaCac: SustainableAcquisitionMetric<ExactRatio>;
  maximumCpl: SustainableAcquisitionMetric<ExactRatio>;
};

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

const INTEGER_PATTERN = /^-?\d+$/;
const ZERO: Rational = { numerator: 0n, denominator: 1n };

export class SustainableAcquisitionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SustainableAcquisitionInputError";
  }
}

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
  if (value.denominator === 0n) {
    throw new SustainableAcquisitionInputError("Exact ratio denominator cannot be zero.");
  }
  if (value.numerator === 0n) return ZERO;

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function requireNonNegativeRatio(value: ExactRatio, fieldName: string): Rational {
  if (!INTEGER_PATTERN.test(value.numerator) || !INTEGER_PATTERN.test(value.denominator)) {
    throw new SustainableAcquisitionInputError(
      `${fieldName} must contain canonical integer ratio parts.`,
    );
  }
  const parsed = normalize({
    numerator: BigInt(value.numerator),
    denominator: BigInt(value.denominator),
  });
  if (parsed.numerator < 0n) {
    throw new SustainableAcquisitionInputError(`${fieldName} cannot be negative.`);
  }
  return parsed;
}

function requirePositiveRatio(value: ExactRatio, fieldName: string) {
  const parsed = requireNonNegativeRatio(value, fieldName);
  if (parsed.numerator === 0n) {
    throw new SustainableAcquisitionInputError(`${fieldName} must be greater than zero.`);
  }
  return parsed;
}

function requirePositiveSafeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new SustainableAcquisitionInputError(`${fieldName} must be a positive safe integer.`);
  }
  return value;
}

function add(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function subtract(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.denominator - right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function multiplyCount(value: Rational, count: number): Rational {
  return normalize({
    numerator: value.numerator * BigInt(count),
    denominator: value.denominator,
  });
}

function divideByCount(value: Rational, count: number): Rational {
  return normalize({
    numerator: value.numerator,
    denominator: value.denominator * BigInt(count),
  });
}

function toExactRatio(value: Rational): ExactRatio {
  const normalized = normalize(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

function available<T>(value: T): SustainableAcquisitionMetric<T> {
  return { available: true, value };
}

function unavailable<T>(
  reason: SustainableAcquisitionMetricUnavailableReason,
): SustainableAcquisitionMetric<T> {
  return { available: false, reason };
}

/**
 * Calculates target-period acquisition ceilings without confusing Acquisition CAC with Mizan's Ultimate CAC.
 * Negative headroom is retained as evidence while the corresponding sustainable metric fails closed.
 */
export function calculateSustainableAcquisitionEconomics(
  input: SustainableAcquisitionInput,
): SustainableAcquisitionResult {
  const requiredRevenue = requirePositiveRatio(input.requiredRevenue, "requiredRevenue");
  const requiredCustomers = requirePositiveSafeInteger(
    input.requiredCustomers,
    "requiredCustomers",
  );
  const requiredLeads = requirePositiveSafeInteger(input.requiredLeads, "requiredLeads");
  const profitConstraintAmount = requireNonNegativeRatio(
    input.profitConstraintAmount,
    "profitConstraintAmount",
  );
  const monthlyFixedAcquisitionCosts = requireNonNegativeRatio(
    input.monthlyFixedAcquisitionCosts,
    "monthlyFixedAcquisitionCosts",
  );
  const monthlyFixedNonAcquisitionCosts = requireNonNegativeRatio(
    input.monthlyFixedNonAcquisitionCosts,
    "monthlyFixedNonAcquisitionCosts",
  );
  const variableNonMediaAcquisitionCostPerNewCustomer = requireNonNegativeRatio(
    input.variableNonMediaAcquisitionCostPerNewCustomer,
    "variableNonMediaAcquisitionCostPerNewCustomer",
  );
  const variableNonAcquisitionCostPerNewCustomer = requireNonNegativeRatio(
    input.variableNonAcquisitionCostPerNewCustomer,
    "variableNonAcquisitionCostPerNewCustomer",
  );

  const variableNonAcquisitionCosts = multiplyCount(
    variableNonAcquisitionCostPerNewCustomer,
    requiredCustomers,
  );
  const projectedNonAcquisitionCosts = add(
    monthlyFixedNonAcquisitionCosts,
    variableNonAcquisitionCosts,
  );
  const acquisitionBudgetHeadroom = subtract(
    subtract(requiredRevenue, projectedNonAcquisitionCosts),
    profitConstraintAmount,
  );

  const variableNonMediaAcquisitionCosts = multiplyCount(
    variableNonMediaAcquisitionCostPerNewCustomer,
    requiredCustomers,
  );
  const mandatoryNonMediaAcquisitionCosts = add(
    monthlyFixedAcquisitionCosts,
    variableNonMediaAcquisitionCosts,
  );
  const mandatoryNonMediaAcquisitionCostPerCustomer = divideByCount(
    mandatoryNonMediaAcquisitionCosts,
    requiredCustomers,
  );
  const mediaBudgetHeadroom = subtract(
    acquisitionBudgetHeadroom,
    mandatoryNonMediaAcquisitionCosts,
  );

  const maximumSustainableAcquisitionCac =
    acquisitionBudgetHeadroom.numerator < 0n
      ? unavailable<ExactRatio>("NO_ACQUISITION_HEADROOM")
      : available(toExactRatio(divideByCount(acquisitionBudgetHeadroom, requiredCustomers)));

  const maximumMediaCac =
    acquisitionBudgetHeadroom.numerator < 0n || mediaBudgetHeadroom.numerator < 0n
      ? unavailable<ExactRatio>("NO_MEDIA_HEADROOM")
      : available(toExactRatio(divideByCount(mediaBudgetHeadroom, requiredCustomers)));

  const maximumCpl = maximumMediaCac.available
    ? available(toExactRatio(divideByCount(mediaBudgetHeadroom, requiredLeads)))
    : unavailable<ExactRatio>("MAX_MEDIA_CAC_UNAVAILABLE");

  return {
    projectedNonAcquisitionCosts: toExactRatio(projectedNonAcquisitionCosts),
    mandatoryNonMediaAcquisitionCosts: toExactRatio(mandatoryNonMediaAcquisitionCosts),
    mandatoryNonMediaAcquisitionCostPerCustomer: toExactRatio(
      mandatoryNonMediaAcquisitionCostPerCustomer,
    ),
    acquisitionBudgetHeadroom: toExactRatio(acquisitionBudgetHeadroom),
    mediaBudgetHeadroom: toExactRatio(mediaBudgetHeadroom),
    maximumSustainableAcquisitionCac,
    maximumMediaCac,
    maximumCpl,
  };
}
