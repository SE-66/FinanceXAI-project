export function normalizeSeries(input) {
  if (!Array.isArray(input)) {
    throw new Error("Series must be an array of numbers.");
  }

  if (input.length < 3) {
    throw new Error("At least 3 observations are required.");
  }

  if (input.length > 5000) {
    throw new Error("A maximum of 5,000 observations is supported.");
  }

  const series = input.map(Number);
  if (series.some((value) => !Number.isFinite(value))) {
    throw new Error("Every observation must be a finite number.");
  }

  return series;
}

export function normalizeHorizon(input) {
  const horizon = Number(input);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 120) {
    throw new Error("Forecast horizon must be an integer between 1 and 120.");
  }
  return horizon;
}

function safePercentChange(from, to) {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

export function linearTrendForecast(rawSeries, rawHorizon) {
  const series = normalizeSeries(rawSeries);
  const horizon = normalizeHorizon(rawHorizon);

  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let x = 0; x < n; x += 1) {
    numerator += (x - xMean) * (series[x] - yMean);
    denominator += (x - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  const fitted = series.map((_, x) => intercept + slope * x);
  const forecast = Array.from(
    { length: horizon },
    (_, index) => intercept + slope * (n + index)
  );

  const residuals = series.map((value, index) => value - fitted[index]);
  const mae = residuals.reduce((sum, value) => sum + Math.abs(value), 0) / n;

  const totalVariance = series.reduce(
    (sum, value) => sum + (value - yMean) ** 2,
    0
  );
  const residualVariance = residuals.reduce(
    (sum, value) => sum + value ** 2,
    0
  );
  const rSquared =
    totalVariance === 0 ? 1 : 1 - residualVariance / totalVariance;

  const latest = series[n - 1];
  const forecastEnd = forecast[forecast.length - 1];

  return {
    forecast,
    metadata: {
      engine: "linear-trend-baseline-v1",
      deterministic: true,
      observations: n,
      horizon
    },
    metrics: {
      latest,
      forecastEnd,
      absoluteChange: forecastEnd - latest,
      percentChange: safePercentChange(latest, forecastEnd),
      slopePerPeriod: slope,
      fitMae: mae,
      rSquared
    }
  };
}
