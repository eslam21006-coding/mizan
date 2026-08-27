import assert from "node:assert/strict";
import test from "node:test";

import {
  compareRationals,
  ZERO_RATIONAL,
} from "../../src/lib/business/exact-rational.ts";

test("Task 33 exact rational comparison normalizes negative denominators", () => {
  assert.equal(compareRationals({ numerator: 1n, denominator: -2n }, ZERO_RATIONAL), -1);
  assert.equal(compareRationals({ numerator: -1n, denominator: -2n }, ZERO_RATIONAL), 1);
  assert.equal(
    compareRationals(
      { numerator: 1n, denominator: -2n },
      { numerator: -1n, denominator: 2n },
    ),
    0,
  );
});
