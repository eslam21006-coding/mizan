import test from 'node:test';
import assert from 'node:assert/strict';

const EPS = 1e-10;
const closeTo = (actual, expected, epsilon = EPS) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
};

const safeDivide = (numerator, denominator, reason) =>
  denominator > 0 ? { value: numerator / denominator, reason: null } : { value: null, reason };

const positiveNetCashDivide = (numerator, netCash) =>
  netCash > 0
    ? { value: numerator / netCash, reason: null }
    : { value: null, reason: 'NON_POSITIVE_NET_CASH' };

const percentExpense = (rate, netCash) => rate * Math.max(netCash, 0);

const roas = ({ attributedRevenue, adSpend }) => {
  if (attributedRevenue == null) return { value: null, reason: 'ATTRIBUTION_UNAVAILABLE' };
  if (adSpend <= 0) return { value: null, reason: 'NO_AD_SPEND' };
  return { value: attributedRevenue / adSpend, reason: null };
};

test('Example A: full business month', () => {
  const gross = 100_000;
  const refunds = 5_000;
  const netCash = gross - refunds;
  const newCustomers = 50;
  const payingCustomers = 80;
  const adSpend = 20_000;

  const acquisition = adSpend + 5_000 + percentExpense(0.10, netCash);
  const fulfillment = 8_000 + 20 * payingCustomers + percentExpense(0.05, netCash);
  const overhead = 10_000;
  const financial = percentExpense(0.03, netCash) + percentExpense(0.05, netCash);
  const allCosts = acquisition + fulfillment + overhead + financial;
  const realNetProfit = netCash - allCosts;

  assert.equal(netCash, 95_000);
  assert.equal(acquisition, 34_500);
  assert.equal(fulfillment, 14_350);
  assert.equal(financial, 7_600);
  assert.equal(allCosts, 66_450);
  assert.equal(realNetProfit, 28_550);
  closeTo(realNetProfit / netCash, 28_550 / 95_000);
  assert.equal(adSpend / newCustomers, 400);
  assert.equal(acquisition / newCustomers, 690);
  assert.equal(allCosts / newCustomers, 1_329);
  assert.equal(netCash / payingCustomers, 1_187.5);
  assert.equal(netCash / newCustomers, 1_900);

  const variableCosts =
    percentExpense(0.10, netCash) +
    20 * payingCustomers +
    percentExpense(0.05, netCash) +
    percentExpense(0.03, netCash) +
    percentExpense(0.05, netCash);
  const contributionProfit = netCash - variableCosts;

  assert.equal(variableCosts, 23_450);
  assert.equal(contributionProfit, 71_550);
  closeTo(contributionProfit / netCash, 71_550 / 95_000);
  assert.equal(netCash / adSpend, 4.75);
  assert.equal(roas({ attributedRevenue: 60_000, adSpend }).value, 3);
});

test('Example B: refund-heavy period does not create negative percentage expenses', () => {
  const netCash = 10_000 - 12_000;
  const percentage = percentExpense(0.10, netCash);
  const allCosts = 1_000 + 3_000 + percentage;
  const profit = netCash - allCosts;

  assert.equal(netCash, -2_000);
  assert.equal(percentage, 0);
  assert.equal(allCosts, 4_000);
  assert.equal(profit, -6_000);
  assert.deepEqual(positiveNetCashDivide(profit, netCash), {
    value: null,
    reason: 'NON_POSITIVE_NET_CASH',
  });
  assert.equal(netCash / 2, -1_000);
  closeTo(netCash / 3, -666.6666666666666);
  assert.equal(netCash / 1_000, -2);
});

test('Example C: no new customers makes CAC and revenue-per-new-customer unavailable', () => {
  const newCustomers = 0;
  const netCash = 5_000;
  const payingCustomers = 5;

  assert.deepEqual(safeDivide(2_000, newCustomers, 'NO_NEW_CUSTOMERS'), {
    value: null,
    reason: 'NO_NEW_CUSTOMERS',
  });
  assert.deepEqual(safeDivide(2_500, newCustomers, 'NO_NEW_CUSTOMERS'), {
    value: null,
    reason: 'NO_NEW_CUSTOMERS',
  });
  assert.deepEqual(safeDivide(4_000, newCustomers, 'NO_NEW_CUSTOMERS'), {
    value: null,
    reason: 'NO_NEW_CUSTOMERS',
  });
  assert.deepEqual(safeDivide(netCash, newCustomers, 'NO_NEW_CUSTOMERS'), {
    value: null,
    reason: 'NO_NEW_CUSTOMERS',
  });
  assert.equal(netCash / payingCustomers, 1_000);
  assert.equal(netCash / 2_000, 2.5);
});

test('Example D: zero ad spend can produce Media CAC 0 but MER/ROAS are unavailable', () => {
  assert.equal(0 / 5, 0);
  assert.deepEqual(safeDivide(10_000, 0, 'NO_AD_SPEND'), {
    value: null,
    reason: 'NO_AD_SPEND',
  });
  assert.deepEqual(roas({ attributedRevenue: 3_000, adSpend: 0 }), {
    value: null,
    reason: 'NO_AD_SPEND',
  });
});

test('Example E: unavailable attribution must not be replaced with business revenue', () => {
  const adSpend = 10_000;
  const businessNetCash = 50_000;

  assert.equal(businessNetCash / adSpend, 5);
  assert.deepEqual(roas({ attributedRevenue: null, adSpend }), {
    value: null,
    reason: 'ATTRIBUTION_UNAVAILABLE',
  });
});

test('Example F: funnel economics', () => {
  const adSpend = 10_000;
  const leads = 500;
  const bookings = 100;
  const shows = 60;
  const qualified = 30;
  const sales = 9;
  const newCustomers = 8;

  assert.equal(adSpend / leads, 20);
  assert.equal(adSpend / bookings, 100);
  closeTo(adSpend / shows, 166.66666666666666);
  closeTo(adSpend / qualified, 333.3333333333333);
  assert.equal(shows / bookings, 0.6);
  assert.equal(qualified / shows, 0.5);
  assert.equal(sales / qualified, 0.3);
  assert.equal(sales / leads, 0.018);
  assert.equal(adSpend / newCustomers, 1_250);
  assert.equal(roas({ attributedRevenue: 20_000, adSpend }).value, 2);
  assert.equal(shows / bookings > 0.65, false);
  assert.equal(sales / qualified > 0.20, true);
});

test('Example G: benchmark boundaries are strict', () => {
  const isHealthyShowRate = (rate) => rate > 0.65;
  const isHealthyCloseRate = (rate) => rate > 0.20;
  const hasAttendanceBottleneck = (showRate, closeRate) =>
    showRate < 0.65 && isHealthyCloseRate(closeRate);

  assert.equal(isHealthyShowRate(0.65), false);
  assert.equal(isHealthyShowRate(0.6501), true);
  assert.equal(isHealthyCloseRate(0.20), false);
  assert.equal(isHealthyCloseRate(0.2001), true);
  assert.equal(hasAttendanceBottleneck(0.65, 0.30), false);
});

test('Example H: liquidation above 100% and negative remaining ad cost are valid', () => {
  const frontEndNetCash = 15_000;
  const variableCosts = 3_000;
  const adSpend = 10_000;
  const contribution = frontEndNetCash - variableCosts;
  const liquidation = contribution / adSpend;
  const remaining = adSpend - contribution;

  assert.equal(contribution, 12_000);
  assert.equal(liquidation, 1.2);
  assert.equal(remaining, -2_000);
});

test('Example I: combined-period margin is ratio of totals, not average monthly margin', () => {
  const combinedNetCash = 1_000 + 100;
  const combinedProfit = 100 + 50;
  const correct = combinedProfit / combinedNetCash;
  const wrongAverage = (0.10 + 0.50) / 2;

  closeTo(correct, 150 / 1_100);
  assert.notEqual(correct, wrongAverage);
});

test('Example J: Observed LTV uses fixed original cohort size and cumulative net cash', () => {
  const originalCohortSize = 4;
  const cumulativeNetCash = 400 + 100 - 80;
  const observedLtv = cumulativeNetCash / originalCohortSize;
  const cohortAgeMonths = 2;

  assert.equal(cumulativeNetCash, 420);
  assert.equal(observedLtv, 105);
  assert.equal(cohortAgeMonths, 2);
  assert.equal(cohortAgeMonths + 1, 3);
});

test('Example K: Lifetime Contribution Profit excludes fixed overhead', () => {
  const lifetimeNetCash = 10_000;
  const acquisition = 2_500;
  const variableFulfillment = 1_000;
  const otherVariable = 500;
  const processor = 300;
  const fixedOverhead = 4_000;

  const lifetimeContributionProfit =
    lifetimeNetCash - acquisition - variableFulfillment - otherVariable - processor;

  assert.equal(lifetimeContributionProfit, 5_700);
  assert.equal(lifetimeContributionProfit - fixedOverhead, 1_700);
  assert.notEqual(lifetimeContributionProfit, 1_700);
});
