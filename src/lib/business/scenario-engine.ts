import type { ExactRatio } from "./calculations.ts";
import {
  addRationals,
  compareRationals,
  divideRationals,
  exactRatioFromRational,
  multiplyRationals,
  normalizeRational,
  ONE_RATIONAL,
  rationalFromExactRatio,
  subtractRationals,
  type Rational,
  ZERO_RATIONAL,
} from "./exact-rational.ts";

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

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

export class ScenarioEngineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioEngineInputError";
  }
}

function parseNonNegativeDecimal(value: string, fieldName: string): Rational {
  const raw = value.trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new ScenarioEngineInputError(`${fieldName} must be a canonical non-negative decimal.`);
  }
  const [whole, fraction = ""] = raw.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  return normalizeRational({
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

function multiplyCount(value: Rational, count: number): Rational {
  return multiplyRationals(value, { numerator: BigInt(count), denominator: 1n });
}

function floorNonNegative(value: Rational, fieldName: string) {
  const normalized = normalizeRational(value);
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
  return normalizeRational({ numerator: BigInt(numerator), denominator: BigInt(denominator) });
}

function requireRate(value: Rational, fieldName: string) {
  if (compareRationals(value, ZERO_RATIONAL) < 0 || compareRationals(value, ONE_RATIONAL) > 0) {
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
  return { value: exactRatioFromRational(resolved), overridden: rawOverride !== undefined };
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
  if (compareRationals(variableCosts, allCosts) > 0) {
    throw new ScenarioEngineInputError("Variable costs cannot exceed all business costs.");
  }

  const fixedNonMediaCosts = subtractRationals(
    subtractRationals(allCosts, variableCosts),
    adSpend,
  );
  if (compareRationals(fixedNonMediaCosts, ZERO_RATIONAL) < 0) {
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
    customerValue: divideRationals(netCash, {
      numerator: BigInt(newCustomers),
      denominator: 1n,
    }),
    variableCostPerCustomer: divideRationals(variableCosts, {
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
  if (compareRationals(currentAdSpend, ZERO_RATIONAL) <= 0) return null;

  return {
    cpl: divideRationals(currentAdSpend, { numerator: BigInt(leads), denominator: 1n }),
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
  if (compareRationals(denominator, ZERO_RATIONAL) <= 0) {
    return { available: false, reason: zeroReason };
  }
  return { available: true, value: exactRatioFromRational(divideRationals(numerator, denominator)) };
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
    cpl: control("cpl", funnel?.cpl ?? ZERO_RATIONAL, overrides),
    ad_spend: control("ad_spend", financial.adSpend, overrides),
    show_rate: control("show_rate", funnel?.showRate ?? ZERO_RATIONAL, overrides),
    qualification_rate: control(
      "qualification_rate",
      funnel?.qualificationRate ?? ZERO_RATIONAL,
      overrides,
    ),
    close_rate: control("close_rate", funnel?.closeRate ?? ZERO_RATIONAL, overrides),
    fixed_costs: control("fixed_costs", financial.fixedNonMediaCosts, overrides),
    variable_costs: control("variable_costs", financial.variableCostPerCustomer, overrides),
    upsells: control("upsells", ZERO_RATIONAL, overrides),
    renewals: control("renewals", ZERO_RATIONAL, overrides),
    backend_revenue: control("backend_revenue", ZERO_RATIONAL, overrides),
  };

  const adSpend = rationalFromExactRatio(controls.ad_spend.value);
  let funnelProjection: ScenarioFunnelProjection;
  let scenarioNewCustomers = financial.newCustomers;

  if (funnel) {
    const cpl = rationalFromExactRatio(controls.cpl.value);
    if (compareRationals(cpl, ZERO_RATIONAL) <= 0) {
      throw new ScenarioEngineInputError(
        "CPL must be greater than zero when funnel projection is available.",
      );
    }

    const leads = floorNonNegative(divideRationals(adSpend, cpl), "scenario leads");
    const bookedCalls = floorNonNegative(
      multiplyCount(funnel.bookingRate, leads),
      "scenario bookings",
    );
    const showedCalls = floorNonNegative(
      multiplyCount(rationalFromExactRatio(controls.show_rate.value), bookedCalls),
      "scenario shows",
    );
    const qualifiedCalls = floorNonNegative(
      multiplyCount(rationalFromExactRatio(controls.qualification_rate.value), showedCalls),
      "scenario qualified calls",
    );
    const sales = floorNonNegative(
      multiplyCount(rationalFromExactRatio(controls.close_rate.value), qualifiedCalls),
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
      heldBookingRate: exactRatioFromRational(funnel.bookingRate),
      heldSaleToNewCustomerRate: exactRatioFromRational(funnel.saleToNewCustomerRate),
    };
  } else {
    funnelProjection = {
      available: false,
      reason: "FUNNEL_BASELINE_UNAVAILABLE",
      newCustomers: scenarioNewCustomers,
    };
  }

  const customerRevenue = multiplyCount(
    rationalFromExactRatio(controls.customer_value.value),
    scenarioNewCustomers,
  );
  const netCashCollected = addRationals(
    addRationals(
      addRationals(customerRevenue, rationalFromExactRatio(controls.upsells.value)),
      rationalFromExactRatio(controls.renewals.value),
    ),
    rationalFromExactRatio(controls.backend_revenue.value),
  );
  const variableCosts = multiplyCount(
    rationalFromExactRatio(controls.variable_costs.value),
    scenarioNewCustomers,
  );
  const allBusinessCosts = addRationals(
    addRationals(rationalFromExactRatio(controls.fixed_costs.value), variableCosts),
    adSpend,
  );
  const realNetProfit = subtractRationals(netCashCollected, allBusinessCosts);

  const customerCount = { numerator: BigInt(scenarioNewCustomers), denominator: 1n };

  return {
    controls,
    funnel: funnelProjection,
    financial: {
      netCashCollected: exactRatioFromRational(netCashCollected),
      allBusinessCosts: exactRatioFromRational(allBusinessCosts),
      realNetProfit: exactRatioFromRational(realNetProfit),
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
