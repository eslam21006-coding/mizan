import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCountRatioPercent,
  formatCountText,
  formatFinancialDecimal,
  formatMoneyText,
} from "../../src/lib/financial-display.ts";

test("financial display rounds long exact decimals only for presentation", () => {
  assert.equal(formatFinancialDecimal("255.218952380952381"), "255.22");
  assert.equal(formatFinancialDecimal("321575.88"), "321,575.88");
  assert.equal(formatFinancialDecimal("6829"), "6,829");
  assert.equal(formatFinancialDecimal("999.999"), "1,000");
  assert.equal(formatFinancialDecimal("1000.004"), "1,000");
  assert.equal(formatFinancialDecimal("-1234.5"), "-1,234.5");
  assert.equal(formatFinancialDecimal("-0.004"), "0");
  assert.equal(formatFinancialDecimal("12345678901234567890.125"), "12,345,678,901,234,567,890.13");
});

test("customer display counts and money use separators without changing source text", () => {
  const source = "321575.880000000000";
  assert.equal(formatMoneyText(source, "USD"), "321,575.88 USD");
  assert.equal(source, "321575.880000000000");
  assert.equal(formatCountText("1260"), "1,260");
  assert.equal(formatCountText(262), "262");
});

test("repeat-customer percentage is derived exactly from integer counts", () => {
  assert.equal(formatCountRatioPercent("262", "1260"), "21%");
  assert.equal(formatCountRatioPercent("0", "0"), null);
  assert.equal(formatCountRatioPercent("4", "3"), null);
});
