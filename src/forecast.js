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
