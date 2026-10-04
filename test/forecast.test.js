import test from "node:test";
import assert from "node:assert/strict";

import {
  linearTrendForecast,
  normalizeHorizon,
  normalizeSeries
} from "../src/forecast.js";

test("normalizes a valid numeric series", () => {
  assert.deepEqual(normalizeSeries(["1", 2, 3]), [1, 2, 3]);
});

test("rejects invalid series", () => {
  assert.throws(() => normalizeSeries([1, 2]), /At least 3/);
  assert.throws(() => normalizeSeries([1, "bad", 3]), /finite number/);
});

test("validates forecast horizon", () => {
  assert.equal(normalizeHorizon(12), 12);
  assert.throws(() => normalizeHorizon(0), /between 1 and 120/);
  assert.throws(() => normalizeHorizon(121), /between 1 and 120/);
});

test("forecasts a simple increasing trend", () => {
  const result = linearTrendForecast([10, 20, 30, 40], 3);

  assert.equal(result.forecast.length, 3);
  assert.ok(result.forecast[0] > 40);
  assert.ok(result.forecast[2] > result.forecast[0]);
  assert.equal(result.metadata.engine, "linear-trend-baseline-v1");
  assert.equal(result.metrics.rSquared, 1);
});

test("handles a flat series deterministically", () => {
  const result = linearTrendForecast([5, 5, 5, 5], 2);

  assert.deepEqual(result.forecast, [5, 5]);
  assert.equal(result.metrics.slopePerPeriod, 0);
  assert.equal(result.metrics.percentChange, 0);
});
