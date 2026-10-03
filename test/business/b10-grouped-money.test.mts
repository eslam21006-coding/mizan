import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOptionalDecimalInput,
  parseOptionalSignedDecimalInput,
} from "../../src/lib/business/monthly.ts";

test("grouped Agency amount is normalized without losing cents", () => {
  assert.deepEqual(parseOptionalDecimalInput("9,336.28"), { ok: true, value: "9336.28" });
  assert.deepEqual(parseOptionalDecimalInput("9336.28"), { ok: true, value: "9336.28" });
  assert.deepEqual(parseOptionalDecimalInput("٩٬٣٣٦٫٢٨"), { ok: true, value: "9336.28" });
  assert.deepEqual(parseOptionalDecimalInput("9,336.28 "), { ok: true, value: "9336.28" });
  assert.deepEqual(parseOptionalDecimalInput("0"), { ok: true, value: "0" });
  assert.deepEqual(parseOptionalDecimalInput(""), { ok: true, value: null });
});

test("grouping must never silently reinterpret malformed money", () => {
  for (const malformed of [
    "9,33", "93,36.28", "9,33,6.28", "93,336,28", "1,23,456",
    "9٬336,28", "9,336٬000", "9,336.123456789", "-9,336.28",
  ]) {
    assert.deepEqual(parseOptionalDecimalInput(malformed), { ok: false, value: null }, malformed);
  }
});

test("historical signed monetary adjustments support valid grouping only", () => {
  assert.deepEqual(parseOptionalSignedDecimalInput("-9,336.28"), { ok: true, value: "-9336.28" });
  assert.deepEqual(parseOptionalSignedDecimalInput("-٩٬٣٣٦٫٢٨"), { ok: true, value: "-9336.28" });
  assert.deepEqual(parseOptionalSignedDecimalInput("-9,33.28"), { ok: false, value: null });
});
