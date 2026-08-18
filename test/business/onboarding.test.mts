import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBusinessName,
  normalizeTimeZone,
  parseBaseCurrency,
  parseCreationRequestId,
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

test("timezone validation accepts named zones but rejects offsets and invented values", () => {
  assert.equal(normalizeTimeZone(" Africa/Cairo "), "Africa/Cairo");
  assert.equal(normalizeTimeZone("UTC"), "UTC");
  assert.equal(normalizeTimeZone("+01:00"), null);
  assert.equal(normalizeTimeZone("Not/ARealTimezone"), null);
  assert.equal(normalizeTimeZone("x".repeat(65)), null);
});

test("creation request IDs accept UUIDs only", () => {
  assert.equal(
    parseCreationRequestId(" 77777777-7777-4777-8777-777777777777 "),
    "77777777-7777-4777-8777-777777777777",
  );
  assert.equal(parseCreationRequestId("not-a-uuid"), null);
  assert.equal(parseCreationRequestId(""), null);
});
