import type { ExternalDataQualitySignal } from "./data-quality.ts";

export type CustomerEconomicsDecisionRow = {
  cohort_month: string | null;
  lifetime_contribution_profit_text: string | null;
  quality_state: string | null;
  currency: string | null;
};

export type CustomerEconomicsDecisionSignal = {
  status: "ready" | "missing" | "incomplete" | "conflict";
  lifetimeContributionProfit: string | null;
  evidenceQuality: "actual" | "estimated" | null;
  currency: string | null;
  acquisitionGroupCount: number;
  sourceReason: string;
};

type ExactDecimal = {
  coefficient: bigint;
  scale: number;
};

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;
const ZERO: ExactDecimal = { coefficient: 0n, scale: 0 };

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

function parseDecimal(value: string): ExactDecimal | null {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) return null;
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const magnitude = BigInt(`${whole}${fraction}` || "0");
  return normalize({
    coefficient: negative ? -magnitude : magnitude,
    scale: fraction.length,
  });
}

function add(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * 10n ** BigInt(scale - left.scale);
  const rightCoefficient = right.coefficient * 10n ** BigInt(scale - right.scale);
  return normalize({ coefficient: leftCoefficient + rightCoefficient, scale });
}

function serialize(value: ExactDecimal) {
  const normalized = normalize(value);
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  const splitAt = padded.length - normalized.scale;
  return `${negative ? "-" : ""}${padded.slice(0, splitAt)}.${padded.slice(splitAt)}`;
}

function result(
  status: CustomerEconomicsDecisionSignal["status"],
  sourceReason: string,
  acquisitionGroupCount: number,
  overrides: Partial<CustomerEconomicsDecisionSignal> = {},
): CustomerEconomicsDecisionSignal {
  return {
    status,
    lifetimeContributionProfit: null,
    evidenceQuality: null,
    currency: null,
    acquisitionGroupCount,
    sourceReason,
    ...overrides,
  };
}

/**
 * Builds the Decision Engine's as-of-month customer-economics signal from disjoint acquisition
 * groups. This is a sign-supporting aggregate only; it does not create a new LTV metric or forecast.
 * Any incomplete group blocks the aggregate instead of treating missing lifetime profit as zero.
 */
export function buildCustomerEconomicsDecisionSignal(
  rows: readonly CustomerEconomicsDecisionRow[],
): CustomerEconomicsDecisionSignal {
  if (rows.length === 0) {
    return result("missing", "NO_CUSTOMER_ECONOMICS_OBSERVATION", 0);
  }

  const seenCohorts = new Set<string>();
  let currency: string | null = null;
  let total = ZERO;
  let hasEstimated = false;
  let hasIncomplete = false;

  for (const row of rows) {
    if (!row.cohort_month || seenCohorts.has(row.cohort_month)) {
      return result("conflict", "DUPLICATE_OR_MISSING_ACQUISITION_GROUP", rows.length);
    }
    seenCohorts.add(row.cohort_month);

    if (!row.currency) {
      return result("conflict", "CUSTOMER_ECONOMICS_CURRENCY_MISSING", rows.length);
    }
    if (currency === null) currency = row.currency;
    else if (row.currency !== currency) {
      return result("conflict", "CUSTOMER_ECONOMICS_CURRENCY_CONFLICT", rows.length);
    }

    if (row.quality_state === "incomplete") {
      hasIncomplete = true;
      continue;
    }
    if (row.quality_state !== "actual" && row.quality_state !== "estimated") {
      return result("conflict", "UNKNOWN_CUSTOMER_ECONOMICS_QUALITY", rows.length);
    }

    if (row.quality_state === "estimated") hasEstimated = true;
    if (row.lifetime_contribution_profit_text === null) {
      return result("conflict", "READY_GROUP_MISSING_LIFETIME_CONTRIBUTION_PROFIT", rows.length);
    }
    const parsed = parseDecimal(row.lifetime_contribution_profit_text);
    if (!parsed) {
      return result("conflict", "INVALID_LIFETIME_CONTRIBUTION_PROFIT", rows.length);
    }
    total = add(total, parsed);
  }

  if (hasIncomplete) {
    return result("incomplete", "AT_LEAST_ONE_ACQUISITION_GROUP_INCOMPLETE", rows.length, {
      currency,
    });
  }

  return result("ready", hasEstimated ? "ESTIMATED_ALLOCATION_PRESENT" : "ALL_GROUPS_ACTUAL", rows.length, {
    lifetimeContributionProfit: serialize(total),
    evidenceQuality: hasEstimated ? "estimated" : "actual",
    currency,
  });
}

/** Maps the downstream signal onto the existing Decision Engine data-quality contract. */
export function customerEconomicsDecisionQualitySignal(
  signal: CustomerEconomicsDecisionSignal,
): ExternalDataQualitySignal {
  if (signal.status === "ready") {
    return { state: "ready", sourceReason: signal.sourceReason };
  }
  if (signal.status === "conflict") {
    return { state: "conflict", sourceReason: signal.sourceReason };
  }
  if (signal.status === "incomplete") {
    return { state: "incomplete", sourceReason: signal.sourceReason };
  }
  return { state: "missing", sourceReason: signal.sourceReason };
}
