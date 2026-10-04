import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeHorizon,
  normalizeSeries
} from "../src/forecast.js";

test("normalizes a valid numeric series", () => {
  assert.deepEqual(normalizeSeries(["1", 2, 3]), [1, 2, 3]);
});

test("rejects too-short and non-numeric series", () => {
  assert.throws(() => normalizeSeries([1, 2]), /At least 3/);
  assert.throws(() => normalizeSeries([1, "bad", 3]), /finite number/);
});

test("rejects oversized series", () => {
  assert.throws(
    () => normalizeSeries(Array.from({ length: 5001 }, () => 1)),
    /maximum of 5,000/
  );
});

test("validates forecast horizon", () => {
  assert.equal(normalizeHorizon(12), 12);
  assert.throws(() => normalizeHorizon(0), /between 1 and 120/);
  assert.throws(() => normalizeHorizon(121), /between 1 and 120/);
  assert.throws(() => normalizeHorizon(1.5), /integer/);
});
