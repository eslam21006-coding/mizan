import type { ExactRatio } from "./calculations.ts";

export type FunnelReverseEngineeringInput = {
  requiredCustomers: number;
  bookingRate: ExactRatio;
  showRate: ExactRatio;
  qualificationRate: ExactRatio;
  closeRate: ExactRatio;
  saleToNewCustomerRate: ExactRatio;
};

export type FunnelReverseEngineeringResult = {
  requiredCustomers: number;
  requiredSales: number;
  requiredQualifiedCalls: number;
  requiredShows: number;
  requiredBookings: number;
  requiredLeads: number;
};

type ValidatedRate = {
  numerator: bigint;
  denominator: bigint;
};

const INTEGER_PATTERN = /^-?\d+$/;

export class FunnelReverseEngineeringInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FunnelReverseEngineeringInputError";
  }
}

function requirePositiveSafeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new FunnelReverseEngineeringInputError(`${fieldName} must be a positive safe integer.`);
  }
  return value;
}

function requireConversionRate(value: ExactRatio, fieldName: string): ValidatedRate {
  if (!INTEGER_PATTERN.test(value.numerator) || !INTEGER_PATTERN.test(value.denominator)) {
    throw new FunnelReverseEngineeringInputError(
      `${fieldName} must contain canonical integer ratio parts.`,
    );
  }

  const numerator = BigInt(value.numerator);
  const denominator = BigInt(value.denominator);
  if (numerator <= 0n || denominator <= 0n) {
    throw new FunnelReverseEngineeringInputError(`${fieldName} must be greater than 0%.`);
  }
  if (numerator > denominator) {
    throw new FunnelReverseEngineeringInputError(`${fieldName} cannot exceed 100%.`);
  }
  return { numerator, denominator };
}

function upstreamCount(downstreamCount: number, conversionRate: ValidatedRate, fieldName: string) {
  const downstream = BigInt(requirePositiveSafeInteger(downstreamCount, fieldName));
  const scaled = downstream * conversionRate.denominator;
  const quotient = scaled / conversionRate.numerator;
  const remainder = scaled % conversionRate.numerator;
  const required = quotient + (remainder === 0n ? 0n : 1n);

  if (required > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new FunnelReverseEngineeringInputError(
      `${fieldName} exceeds the safe integer planning boundary.`,
    );
  }
  return Number(required);
}

/**
 * Works backward from required new customers through the funnel.
 * Every stage is ceiled before the preceding stage is calculated so fractional people/calls never under-plan the target.
 */
export function reverseEngineerFunnel(
  input: FunnelReverseEngineeringInput,
): FunnelReverseEngineeringResult {
  const requiredCustomers = requirePositiveSafeInteger(
    input.requiredCustomers,
    "requiredCustomers",
  );
  const saleToNewCustomerRate = requireConversionRate(
    input.saleToNewCustomerRate,
    "saleToNewCustomerRate",
  );
  const closeRate = requireConversionRate(input.closeRate, "closeRate");
  const qualificationRate = requireConversionRate(
    input.qualificationRate,
    "qualificationRate",
  );
  const showRate = requireConversionRate(input.showRate, "showRate");
  const bookingRate = requireConversionRate(input.bookingRate, "bookingRate");

  const requiredSales = upstreamCount(
    requiredCustomers,
    saleToNewCustomerRate,
    "requiredSales",
  );
  const requiredQualifiedCalls = upstreamCount(
    requiredSales,
    closeRate,
    "requiredQualifiedCalls",
  );
  const requiredShows = upstreamCount(
    requiredQualifiedCalls,
    qualificationRate,
    "requiredShows",
  );
  const requiredBookings = upstreamCount(requiredShows, showRate, "requiredBookings");
  const requiredLeads = upstreamCount(requiredBookings, bookingRate, "requiredLeads");

  return {
    requiredCustomers,
    requiredSales,
    requiredQualifiedCalls,
    requiredShows,
    requiredBookings,
    requiredLeads,
  };
}
