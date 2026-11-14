import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeNumeric, parseNumber } from "./numeric";

test("parseNumber handles Indian formatting and symbols", () => {
  assert.equal(parseNumber("₹1,25,000"), 125000);
  assert.equal(parseNumber("Rs. 4,500.50"), 4500.5);
  assert.equal(parseNumber("12.5%"), 12.5);
  assert.equal(parseNumber("-3.2"), -3.2);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("abc"), null);
});

test("gradeNumeric accepts answers within tolerance", () => {
  assert.equal(gradeNumeric("1,800", 1800, 1), true);
  assert.equal(gradeNumeric("1815", 1800, 1), true);
  assert.equal(gradeNumeric("1830", 1800, 1), false);
  assert.equal(gradeNumeric("0.25", 0.25, null), true);
  assert.equal(gradeNumeric("", 10, 1), false);
});
