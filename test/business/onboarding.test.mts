import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBusinessName,
  normalizeTimeZone,
  parseBaseCurrency,
  SUPPORTED_CURRENCIES,
} from "../../src/lib/business/onboarding.ts";

test("Task 5 supports exactly the approved V1 business currencies", () => {
  assert.deepEqual(SUPPORTED_CURRENCIES, ["USD", "AED", "SAR", "EGP", "KWD", "QAR", "JOD", "EUR"]);
});

test("business name normalization trims and collapses whitespace", () => {
  assert.equal(normalizeBusinessName("  أكاديمية   ميزان  "), "أكاديمية ميزان");
  assert.equal(normalizeBusinessName("   "), null);
  assert.equal(normalizeBusinessName("x".repeat(121)), null);
});

test("base currency parsing rejects unsupported values", () => {
  assert.equal(parseBaseCurrency(" egp "), "EGP");
  assert.equal(parseBaseCurrency("GBP"), null);
  assert.equal(parseBaseCurrency(null), null);
});

test("timezone validation accepts real IANA zones and rejects invented values", () => {
  assert.equal(normalizeTimeZone(" Africa/Cairo "), "Africa/Cairo");
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(normalizeTimeZone("Not/ARealTimezone"), null);
  assert.equal(normalizeTimeZone("x".repeat(65)), null);
});
