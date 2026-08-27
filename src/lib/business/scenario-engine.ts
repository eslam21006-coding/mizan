import type { ExactRatio } from "./calculations.ts";

export const SCENARIO_OVERRIDE_KEYS = [
  "customer_value",
  "cpl",
  "ad_spend",
  "show_rate",
  "qualification_rate",
  "close_rate",
  "fixed_costs",
  "variable_costs",
  "upsells",
  "renewals",
  "backend_revenue",
] as const;

export type ScenarioOverrideKey = (typeof SCENARIO_OVERRIDE_KEYS)[number];
export type ScenarioOverrides = Partial<Record<ScenarioOverrideKey, string>>;

export type ScenarioFinancialBaseline = {
  netCashCollected: string;
  allBusinessCosts: string;
  variableCosts: string;
  newCustomers: number;
  adSpend: string;
};

export type ScenarioFunnelBaseline = {
  leads: number;
  bookedCalls: number;
  showedCalls: number;
  qualifiedCalls: number;
  sales: number;
  newCustomers: number;
};

export type ScenarioEngineInput = {
  financial: ScenarioFinancialBaseline;
  funnel: ScenarioFunnelBaseline | null;
  overrides?: ScenarioOverrides;
};

export type ScenarioControlValue = {
  value: ExactRatio;
  overridden: boolean;
};

export type ScenarioResolvedControls = Record<ScenarioOverrideKey, ScenarioControlValue>;

export type ScenarioFunnelProjection =
  | {
      available: true;
      leads: number;
      bookedCalls: number;
      showedCalls: number;
      qualifiedCalls: number;
      sales: number;
      newCustomers: number;
      heldBookingRate: ExactRatio;
      heldSaleToNewCustomerRate: ExactRatio;
    }
  | {
      available: false;
      reason: "FUNNEL_BASELINE_UNAVAILABLE";
      newCustomers: number;
    };

export type ScenarioMetric<T> =
  | { available: true; value: T }
  | {
      available: false;
      reason:
        | "NO_NEW_CUSTOMERS"
        | "NON_POSITIVE_NET_CASH"
        | "NO_AD_SPEND"
        | "FUNNEL_BASELINE_UNAVAILABLE";
    };

export type ScenarioFinancialProjection = {
  netCashCollected: ExactRatio;
  allBusinessCosts: ExactRatio;
  realNetProfit: ExactRatio;
  realNetProfitMargin: ScenarioMetric<ExactRatio>;
  ultimateCac: ScenarioMetric<ExactRatio>;
  mediaCac: ScenarioMetric<ExactRatio>;
  mer: ScenarioMetric<ExactRatio>;
};

export type ScenarioEngineResult = {
  controls: ScenarioResolvedControls;
  funnel: ScenarioFunnelProjection;
  financial: ScenarioFinancialProjection;
};

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;
const ZERO: Rational = { numerator: 0n, denominator: 1n };
const ONE: Rational = { numerator: 1n, denominator: 1n };

export class ScenarioEngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioEngineInputError";
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
    throw new ScenarioEngineInputError("Scenario ratio denominator cannot be zero.");
  }
  if (value.numerator === 0n) return ZERO;

  const sign = value.denominator < 0n ? -1n : 1n;
  const numerator = value.numerator * sign;
  const denominator = value.denominator * sign;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function parseNonNegativeDecimal(value: string, fieldName: string): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new ScenarioEngineInputError(`${fieldName} must be a canonical non-negative decimal.`);
  }
  const [whole, fraction = ""] = raw.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  return normalize({
    numerator: BigInt(`${whole}${fraction}` || "0"),
    denominator,
  });
}

function requireNonNegativeSafeInteger(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ScenarioEngineInputError(`${fieldName} must be a non-negative safe integer.`);
  }
  return value;
}

function toExactRatio(value: Rational): ExactRatio {
  const normalized = normalize(value);
  return {
    numerator: normalized.numerator.toString(),
    denominator: normalized.denominator.toString(),
  };
}

function fromExactRatio(value: ExactRatio): Rational {
  return normalize({ numerator: BigInt(value.numerator), denominator: BigInt(value.denominator) });
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

function multiply(left: Rational, right: Rational): Rational {
  return normalize({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
}

function divide(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n) {
    throw new ScenarioEngineInputError("Scenario calculation cannot divide by zero.");
  }
  return normalize({
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  });
}

function compare(left: Rational, right: Rational) {
  const scaledLeft = left.numerator * right.denominator;
  const scaledRight = right.numerator * left.denominator;
  return scaledLeft === scaledRight ? 0 : scaledLeft > scaledRight ? 1 : -1;
}

function multiplyCount(value: Rational, count: number): Rational {
  return multiply(value, { numerator: BigInt(count), denominator: 1n });
}

function floorNonNegative(value: Rational, fieldName: string) {
  const normalized = normalize(value);
  if (normalized.numerator < 0n) {
    throw new ScenarioEngineInputError(`${fieldName} cannot be negative.`);
  }
  const result = normalized.numerator / normalized.denominator;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ScenarioEngineInputError(`${fieldName} exceeds the safe integer planning boundary.`);
  }
  return Number(result);
}

function countRatio(numerator: number, denominator: number, fieldName: string) {
  requireNonNegativeSafeInteger(numerator, `${fieldName}.numerator`);
  requireNonNegativeSafeInteger(denominator, `${fieldName}.denominator`);
  if (denominator === 0) {
    throw new ScenarioEngineInputError(`${fieldName} denominator must be greater than zero.`);
  }
  return normalize({ numerator: BigInt(numerator), denominator: BigInt(denominator) });
}

function requireRate(value: Rational, fieldName: string) {
  if (compare(value, ZERO) < 0 || compare(value, ONE) > 0) {
    throw new ScenarioEngineInputError(`${fieldName} must be between 0% and 100%.`);
  }
  return value;
}

function control(
  key: ScenarioOverrideKey,
  baseline: Rational,
  overrides: ScenarioOverrides,
): ScenarioControlValue {
  const rawOverride = overrides[key];
  const resolved = rawOverride === undefined ? baseline : parseNonNegativeDecimal(rawOverride, key);
  if (key === "show_rate" || key === "qualification_rate" || key === "close_rate") {
    requireRate(resolved, key);
  }
  return { value: toExactRatio(resolved), overridden: rawOverride !== undefined };
}

function resolveFinancialBaselines(financial: ScenarioFinancialBaseline) {
  const netCash = parseNonNegativeDecimal(financial.netCashCollected, "netCashCollected");
  const allCosts = parseNonNegativeDecimal(financial.allBusinessCosts, "allBusinessCosts");
  const variableCosts = parseNonNegativeDecimal(financial.variableCosts, "variableCosts");
  const adSpend = parseNonNegativeDecimal(financial.adSpend, "adSpend");
  const newCustomers = requireNonNegativeSafeInteger(financial.newCustomers, "newCustomers");

  if (newCustomers === 0) {
    throw new ScenarioEngineInputError("Scenario baseline requires at least one actual new customer.");
  }
  if (compare(variableCosts, allCosts) > 0) {
    throw new ScenarioEngineInputError("Variable costs cannot exceed all business costs.");
  }

  const fixedNonMediaCosts = subtract(subtract(allCosts, variableCosts), adSpend);
  if (compare(fixedNonMediaCosts, ZERO) < 0) {
    throw new ScenarioEngineInputError(
      "Current ad spend and variable costs exceed all business costs; scenario cost basis is inconsistent.",
    );
  }

  return {
    netCash,
    allCosts,
    variableCosts,
    adSpend,
    newCustomers,
    customerValue: divide(netCash, { numerator: BigInt(newCustomers), denominator: 1n }),
    variableCostPerCustomer: divide(variableCosts, {
      numerator: BigInt(newCustomers),
      denominator: 1n,
    }),
    fixedNonMediaCosts,
  };
}

function resolveFunnelBaselines(
  funnel: ScenarioFunnelBaseline | null,
  currentAdSpend: Rational,
  currentNewCustomers: number,
) {
  if (!funnel) return null;

  const leads = requireNonNegativeSafeInteger(funnel.leads, "funnel.leads");
  const bookedCalls = requireNonNegativeSafeInteger(funnel.bookedCalls, "funnel.bookedCalls");
  const showedCalls = requireNonNegativeSafeInteger(funnel.showedCalls, "funnel.showedCalls");
  const qualifiedCalls = requireNonNegativeSafeInteger(
    funnel.qualifiedCalls,
    "funnel.qualifiedCalls",
  );
  const sales = requireNonNegativeSafeInteger(funnel.sales, "funnel.sales");
  const newCustomers = requireNonNegativeSafeInteger(funnel.newCustomers, "funnel.newCustomers");

  if (
    leads === 0 ||
    bookedCalls === 0 ||
    showedCalls === 0 ||
    qualifiedCalls === 0 ||
    sales === 0 ||
    newCustomers === 0
  ) {
    return null;
  }
  if (
    bookedCalls > leads ||
    showedCalls > bookedCalls ||
    qualifiedCalls > showedCalls ||
    sales > qualifiedCalls ||
    newCustomers > sales
  ) {
    throw new ScenarioEngineInputError("Funnel baseline contains an impossible downstream count.");
  }
  if (newCustomers !== currentNewCustomers) {
    throw new ScenarioEngineInputError(
      "Funnel new-customer total must match the business monthly new-customer actual.",
    );
  }
  if (compare(currentAdSpend, ZERO) <= 0) return null;

  return {
    cpl: divide(currentAdSpend, { numerator: BigInt(leads), denominator: 1n }),
    bookingRate: countRatio(bookedCalls, leads, "bookingRate"),
    showRate: countRatio(showedCalls, bookedCalls, "showRate"),
    qualificationRate: countRatio(qualifiedCalls, showedCalls, "qualificationRate"),
    closeRate: countRatio(sales, qualifiedCalls, "closeRate"),
    saleToNewCustomerRate: countRatio(newCustomers, sales, "saleToNewCustomerRate"),
  };
}

function ratioMetric(
  numerator: Rational,
  denominator: Rational,
  zeroReason: "NO_NEW_CUSTOMERS" | "NON_POSITIVE_NET_CASH" | "NO_AD_SPEND",
): ScenarioMetric<ExactRatio> {
  if (compare(denominator, ZERO) <= 0) return { available: false, reason: zeroReason };
  return { available: true, value: toExactRatio(divide(numerator, denominator)) };
}

/**
 * Projects a hypothetical monthly scenario without mutating historical actuals.
 * Baseline values are exact ratios; sparse persisted overrides replace only controls the user changed.
 */
export function calculateScenario(input: ScenarioEngineInput): ScenarioEngineResult {
  const overrides = input.overrides ?? {};
  for (const key of Object.keys(overrides)) {
    if (!SCENARIO_OVERRIDE_KEYS.includes(key as ScenarioOverrideKey)) {
      throw new ScenarioEngineInputError(`Unsupported scenario override key: ${key}`);
    }
  }

  const financial = resolveFinancialBaselines(input.financial);
  const funnel = resolveFunnelBaselines(input.funnel, financial.adSpend, financial.newCustomers);

  const controls: ScenarioResolvedControls = {
    customer_value: control("customer_value", financial.customerValue, overrides),
    cpl: control("cpl", funnel?.cpl ?? ZERO, overrides),
    ad_spend: control("ad_spend", financial.adSpend, overrides),
    show_rate: control("show_rate", funnel?.showRate ?? ZERO, overrides),
    qualification_rate: control(
      "qualification_rate",
      funnel?.qualificationRate ?? ZERO,
      overrides,
    ),
    close_rate: control("close_rate", funnel?.closeRate ?? ZERO, overrides),
    fixed_costs: control("fixed_costs", financial.fixedNonMediaCosts, overrides),
    variable_costs: control("variable_costs", financial.variableCostPerCustomer, overrides),
    upsells: control("upsells", ZERO, overrides),
    renewals: control("renewals", ZERO, overrides),
    backend_revenue: control("backend_revenue", ZERO, overrides),
  };

  const adSpend = fromExactRatio(controls.ad_spend.value);
  let funnelProjection: ScenarioFunnelProjection;
  let scenarioNewCustomers = financial.newCustomers;

  if (funnel) {
    const cpl = fromExactRatio(controls.cpl.value);
    if (compare(cpl, ZERO) <= 0) {
      throw new ScenarioEngineInputError("CPL must be greater than zero when funnel projection is available.");
    }

    const leads = floorNonNegative(divide(adSpend, cpl), "scenario leads");
    const bookedCalls = floorNonNegative(
      multiplyCount(funnel.bookingRate, leads),
      "scenario bookings",
    );
    const showedCalls = floorNonNegative(
      multiplyCount(fromExactRatio(controls.show_rate.value), bookedCalls),
      "scenario shows",
    );
    const qualifiedCalls = floorNonNegative(
      multiplyCount(fromExactRatio(controls.qualification_rate.value), showedCalls),
      "scenario qualified calls",
    );
    const sales = floorNonNegative(
      multiplyCount(fromExactRatio(controls.close_rate.value), qualifiedCalls),
      "scenario sales",
    );
    scenarioNewCustomers = floorNonNegative(
      multiplyCount(funnel.saleToNewCustomerRate, sales),
      "scenario new customers",
    );

    funnelProjection = {
      available: true,
      leads,
      bookedCalls,
      showedCalls,
      qualifiedCalls,
      sales,
      newCustomers: scenarioNewCustomers,
      heldBookingRate: toExactRatio(funnel.bookingRate),
      heldSaleToNewCustomerRate: toExactRatio(funnel.saleToNewCustomerRate),
    };
  } else {
    funnelProjection = {
      available: false,
      reason: "FUNNEL_BASELINE_UNAVAILABLE",
      newCustomers: scenarioNewCustomers,
    };
  }

  const customerRevenue = multiplyCount(
    fromExactRatio(controls.customer_value.value),
    scenarioNewCustomers,
  );
  const netCashCollected = add(
    add(
      add(customerRevenue, fromExactRatio(controls.upsells.value)),
      fromExactRatio(controls.renewals.value),
    ),
    fromExactRatio(controls.backend_revenue.value),
  );
  const variableCosts = multiplyCount(
    fromExactRatio(controls.variable_costs.value),
    scenarioNewCustomers,
  );
  const allBusinessCosts = add(
    add(fromExactRatio(controls.fixed_costs.value), variableCosts),
    adSpend,
  );
  const realNetProfit = subtract(netCashCollected, allBusinessCosts);

  const customerCount = { numerator: BigInt(scenarioNewCustomers), denominator: 1n };

  return {
    controls,
    funnel: funnelProjection,
    financial: {
      netCashCollected: toExactRatio(netCashCollected),
      allBusinessCosts: toExactRatio(allBusinessCosts),
      realNetProfit: toExactRatio(realNetProfit),
      realNetProfitMargin: ratioMetric(
        realNetProfit,
        netCashCollected,
        "NON_POSITIVE_NET_CASH",
      ),
      ultimateCac: ratioMetric(allBusinessCosts, customerCount, "NO_NEW_CUSTOMERS"),
      mediaCac: ratioMetric(adSpend, customerCount, "NO_NEW_CUSTOMERS"),
      mer: ratioMetric(netCashCollected, adSpend, "NO_AD_SPEND"),
    },
  };
}
