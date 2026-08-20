import assert from "node:assert/strict";
import test from "node:test";
import type { CalculatedMetric, ExactRatio } from "../../src/lib/business/calculations.ts";
import {
  compareCountMetrics,
  compareDecimalMetrics,
  compareRatioMetrics,
} from "../../src/lib/business/comparison.ts";

function available<T>(value: T): CalculatedMetric<T> {
  return { available: true, value };
}

function unavailable<T>(): CalculatedMetric<T> {
  return { available: false, reason: "INPUT_UNAVAILABLE" };
}

function ratio(numerator: string, denominator: string): ExactRatio {
  return { numerator, denominator };
}

test("money comparison keeps exact signed change and relative change", () => {
  assert.deepEqual(compareDecimalMetrics(available("13500"), available("12000")), {
    available: true,
    direction: "up",
    change: ratio("1500", "1"),
    relativeChange: ratio("1", "8"),
  });

  assert.deepEqual(compareDecimalMetrics(available("9727.5"), available("10500")), {
    available: true,
    direction: "down",
    change: ratio("-1545", "2"),
    relativeChange: ratio("-103", "1400"),
  });
});

test("relative change uses previous magnitude when profit crosses zero", () => {
  assert.deepEqual(compareDecimalMetrics(available("5000"), available("-10000")), {
    available: true,
    direction: "up",
    change: ratio("15000", "1"),
    relativeChange: ratio("3", "2"),
  });
});

test("relative percentage is unavailable when previous value is exactly zero", () => {
  assert.deepEqual(compareCountMetrics(available(5), available(0)), {
    available: true,
    direction: "up",
    change: ratio("5", "1"),
    relativeChange: null,
  });
});

test("ratio comparison returns exact percentage-point delta input", () => {
  assert.deepEqual(compareRatioMetrics(available(ratio("3", "4")), available(ratio("7", "10"))), {
    available: true,
    direction: "up",
    change: ratio("1", "20"),
    relativeChange: ratio("1", "14"),
  });
});

test("comparison fails closed when either month is unavailable", () => {
  assert.deepEqual(compareDecimalMetrics(unavailable(), available("100")), {
    available: false,
    reason: "CURRENT_UNAVAILABLE",
  });
  assert.deepEqual(compareDecimalMetrics(available("100"), unavailable()), {
    available: false,
    reason: "PREVIOUS_UNAVAILABLE",
  });
});

test("flat comparison remains exact", () => {
  assert.deepEqual(compareDecimalMetrics(available("123.450"), available("123.45")), {
    available: true,
    direction: "flat",
    change: ratio("0", "1"),
    relativeChange: ratio("0", "1"),
  });
});
