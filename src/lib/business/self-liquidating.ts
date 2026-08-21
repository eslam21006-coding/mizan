import type { ExactRatio } from "./calculations.ts";

export type LiquidationUnavailableReason =
  | "FRONT_END_REVENUE_INCOMPLETE"
  | "VARIABLE_COST_ALLOCATION_INCOMPLETE"
  | "AD_SPEND_UNAVAILABLE"
  | "NO_AD_SPEND";

export type LiquidationMetric<T> =
  | { available: true; value: T }
  | { available: false; reason: LiquidationUnavailableReason };

export type FrontEndRevenueInput = {
  grossCash: string | null;
  refunds: string | null;
};

export type FrontEndVariableExpenseInput = {
  expenseAmount: string | null;
  allocatedAmount: string | null;
};

export type SelfLiquidationInput = {
  frontEndRevenue: readonly FrontEndRevenueInput[];
  variableExpenses: readonly FrontEndVariableExpenseInput[];
  adSpend: string | null;
};

export type SelfLiquidationResult = {
  frontEndNetCash: LiquidationMetric<string>;
  frontEndVariableCosts: LiquidationMetric<string>;
  frontEndContributionProfit: LiquidationMetric<string>;
  adLiquidationRate: LiquidationMetric<ExactRatio>;
  effectiveRemainingAdCost: LiquidationMetric<string>;
  allocationComplete: boolean;
};

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const ZERO: ExactDecimal = { coefficient: 0n, scale: 0 };
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

export class SelfLiquidationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelfLiquidationInputError";
  }
}

function available<T>(value: T): LiquidationMetric<T> {
  return { available: true, value };
}

function unavailable<T>(reason: LiquidationUnavailableReason): LiquidationMetric<T> {
  return { available: false, reason };
}

function powerOfTen(exponent: number) {
  return 10n ** BigInt(exponent);
}

function normalize(value: ExactDecimal): ExactDecimal {
  if (value.coefficient === 0n) return ZERO;
  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function parseDecimal(value: string, fieldName: string, allowNegative = false): ExactDecimal {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new SelfLiquidationInputError(`${fieldName} must be a canonical decimal string.`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const parsed = normalize({
    coefficient: BigInt(`${whole}${fraction}` || "0") * (negative ? -1n : 1n),
    scale: fraction.length,
  });

  if (!allowNegative && parsed.coefficient < 0n) {
    throw new SelfLiquidationInputError(`${fieldName} cannot be negative.`);
  }

  return parsed;
}

function align(left: ExactDecimal, right: ExactDecimal) {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * powerOfTen(scale - left.scale),
    right: right.coefficient * powerOfTen(scale - right.scale),
    scale,
  };
}

function add(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return normalize({ coefficient: aligned.left + aligned.right, scale: aligned.scale });
}

function subtract(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return normalize({ coefficient: aligned.left - aligned.right, scale: aligned.scale });
}

function compare(left: ExactDecimal, right: ExactDecimal) {
  const aligned = align(left, right);
  return aligned.left === aligned.right ? 0 : aligned.left > aligned.right ? 1 : -1;
}

function decimalToString(value: ExactDecimal) {
  const normalized = normalize(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  const splitAt = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
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

function exactRatio(numerator: ExactDecimal, denominator: ExactDecimal): ExactRatio {
  if (denominator.coefficient === 0n) {
    throw new SelfLiquidationInputError("Cannot construct a ratio with a zero denominator.");
  }

  let numeratorInteger = numerator.coefficient * powerOfTen(denominator.scale);
  let denominatorInteger = denominator.coefficient * powerOfTen(numerator.scale);
  if (denominatorInteger < 0n) {
    numeratorInteger *= -1n;
    denominatorInteger *= -1n;
  }

  if (numeratorInteger === 0n) return { numerator: "0", denominator: "1" };
  const divisor = gcd(numeratorInteger, denominatorInteger);
  return {
    numerator: (numeratorInteger / divisor).toString(),
    denominator: (denominatorInteger / divisor).toString(),
  };
}

function frontEndNetCash(
  rows: readonly FrontEndRevenueInput[],
): LiquidationMetric<ExactDecimal> {
  let total = ZERO;
  for (const [index, row] of rows.entries()) {
    if (row.grossCash === null || row.refunds === null) {
      return unavailable("FRONT_END_REVENUE_INCOMPLETE");
    }
    const gross = parseDecimal(row.grossCash, `frontEndRevenue[${index}].grossCash`);
    const refunds = parseDecimal(row.refunds, `frontEndRevenue[${index}].refunds`);
    total = add(total, subtract(gross, refunds));
  }
  return available(total);
}

function allocatedVariableCosts(
  rows: readonly FrontEndVariableExpenseInput[],
): LiquidationMetric<ExactDecimal> {
  let total = ZERO;

  for (const [index, row] of rows.entries()) {
    if (row.expenseAmount === null) {
      return unavailable("VARIABLE_COST_ALLOCATION_INCOMPLETE");
    }

    const expenseAmount = parseDecimal(row.expenseAmount, `variableExpenses[${index}].expenseAmount`);
    if (row.allocatedAmount === null) {
      if (compare(expenseAmount, ZERO) === 0) continue;
      return unavailable("VARIABLE_COST_ALLOCATION_INCOMPLETE");
    }

    const allocatedAmount = parseDecimal(
      row.allocatedAmount,
      `variableExpenses[${index}].allocatedAmount`,
    );
    if (compare(allocatedAmount, expenseAmount) > 0) {
      throw new SelfLiquidationInputError(
        `variableExpenses[${index}].allocatedAmount cannot exceed expenseAmount.`,
      );
    }
    total = add(total, allocatedAmount);
  }

  return available(total);
}

export function calculateSelfLiquidation(input: SelfLiquidationInput): SelfLiquidationResult {
  const netCash = frontEndNetCash(input.frontEndRevenue);
  const variableCosts = allocatedVariableCosts(input.variableExpenses);
  const adSpend =
    input.adSpend === null
      ? unavailable<ExactDecimal>("AD_SPEND_UNAVAILABLE")
      : available(parseDecimal(input.adSpend, "adSpend"));

  const contribution: LiquidationMetric<ExactDecimal> = (() => {
    if (!netCash.available) return unavailable(netCash.reason);
    if (!variableCosts.available) return unavailable(variableCosts.reason);
    return available(subtract(netCash.value, variableCosts.value));
  })();

  const liquidationRate: LiquidationMetric<ExactRatio> = (() => {
    if (!contribution.available) return unavailable(contribution.reason);
    if (!adSpend.available) return unavailable(adSpend.reason);
    if (compare(adSpend.value, ZERO) === 0) return unavailable("NO_AD_SPEND");
    return available(exactRatio(contribution.value, adSpend.value));
  })();

  const remainingAdCost: LiquidationMetric<ExactDecimal> = (() => {
    if (!contribution.available) return unavailable(contribution.reason);
    if (!adSpend.available) return unavailable(adSpend.reason);
    return available(subtract(adSpend.value, contribution.value));
  })();

  return {
    frontEndNetCash: netCash.available
      ? available(decimalToString(netCash.value))
      : unavailable(netCash.reason),
    frontEndVariableCosts: variableCosts.available
      ? available(decimalToString(variableCosts.value))
      : unavailable(variableCosts.reason),
    frontEndContributionProfit: contribution.available
      ? available(decimalToString(contribution.value))
      : unavailable(contribution.reason),
    adLiquidationRate: liquidationRate,
    effectiveRemainingAdCost: remainingAdCost.available
      ? available(decimalToString(remainingAdCost.value))
      : unavailable(remainingAdCost.reason),
    allocationComplete: variableCosts.available,
  };
}
