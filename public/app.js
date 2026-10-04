const sample = {
  name: "Monthly revenue",
  unit: "$",
  periods: [
    "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06",
    "2025-07","2025-08","2025-09","2025-10","2025-11","2025-12"
  ],
  values: [184000,191500,189200,203800,211300,218900,226400,231800,240600,247900,255300,264700]
};

const state = {
  periods: [],
  values: [],
  forecast: [],
  metrics: null,
  metadata: null,
  source: "sample"
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  seriesName: document.querySelector("#seriesName"),
  valueUnit: document.querySelector("#valueUnit"),
  horizon: document.querySelector("#horizon"),
  forecastButton: document.querySelector("#forecastButton"),
  exportButton: document.querySelector("#exportButton"),
  status: document.querySelector("#status"),
  dataBadge: document.querySelector("#dataBadge"),
  observationCount: document.querySelector("#observationCount"),
  valueHeader: document.querySelector("#valueHeader"),
  inputTableBody: document.querySelector("#inputTableBody"),
  forecastTableBody: document.querySelector("#forecastTableBody"),
  forecastCount: document.querySelector("#forecastCount"),
  chartTitle: document.querySelector("#chartTitle"),
  actualPath: document.querySelector("#actualPath"),
  forecastPath: document.querySelector("#forecastPath"),
  splitLine: document.querySelector("#splitLine"),
  metricLatest: document.querySelector("#metricLatest"),
  metricEnd: document.querySelector("#metricEnd"),
  metricChange: document.querySelector("#metricChange"),
  metricSlope: document.querySelector("#metricSlope"),
  metricMae: document.querySelector("#metricMae"),
  metricR2: document.querySelector("#metricR2")
};

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", error);
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }

  values.push(value.trim());
  return values;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 3) {
    throw new Error("CSV must contain at least 3 usable rows.");
  }

  const rows = lines.map(parseCsvLine);
  const width = Math.max(...rows.map((row) => row.length));
  const firstRow = rows[0];
  const hasHeader = firstRow.some(
    (cell) => cell !== "" && !Number.isFinite(Number(cell.replace(/,/g, "")))
  );

  const headers = hasHeader
    ? Array.from({ length: width }, (_, index) => firstRow[index] || `Column ${index + 1}`)
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);

  const dataRows = rows.slice(hasHeader ? 1 : 0);
  const scores = headers.map((_, column) =>
    dataRows.filter((row) => {
      const raw = row[column];
      if (raw === undefined || raw === "") return false;
      return Number.isFinite(Number(raw.replace(/,/g, "")));
    }).length
  );

  const bestScore = Math.max(...scores);
  const valueColumn = scores.indexOf(bestScore);

  if (bestScore < 3) {
    throw new Error("No numeric column with at least 3 observations was found.");
  }

  const namedPeriod = headers.findIndex((header, index) =>
    index !== valueColumn && /^(period|date|time|month|quarter|week|year)$/i.test(header.trim())
  );

  let periodColumn = namedPeriod;
  if (periodColumn < 0) {
    periodColumn = headers.findIndex((_, index) => index !== valueColumn && scores[index] < bestScore);
  }

  const periods = [];
  const values = [];

  dataRows.forEach((row, index) => {
    const raw = row[valueColumn];
    if (raw === undefined || raw === "") return;

    const numeric = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return;

    values.push(numeric);
    periods.push(
      periodColumn >= 0 && row[periodColumn]
        ? row[periodColumn]
        : String(index + 1)
    );
  });

  if (values.length < 3) {
    throw new Error("CSV must contain at least 3 numeric observations.");
  }

  return {
    name: headers[valueColumn] || "Value",
    periods,
    values
  };
}

function currencyLikeUnit(unit) {
  return ["$", "€", "£", "¥", "₹"].includes(unit.trim());
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

function formatValue(value) {
  if (!Number.isFinite(value)) return "—";
  const unit = elements.valueUnit.value.trim();
  const number = formatNumber(value);

  if (!unit) return number;
  return currencyLikeUnit(unit) ? `${unit}${number}` : `${number} ${unit}`;
}

function resetForecast() {
  state.forecast = [];
  state.metrics = null;
  state.metadata = null;
  elements.exportButton.disabled = true;
  renderResults();
}

function loadSample() {
  state.periods = [...sample.periods];
  state.values = [...sample.values];
  state.source = "sample";
  elements.seriesName.value = sample.name;
  elements.valueUnit.value = sample.unit;
  elements.horizon.value = "12";
  elements.fileInput.value = "";
  resetForecast();
  renderInput();
  setStatus("Ready. Sample data is loaded.");
}

function clearData() {
  state.periods = [];
  state.values = [];
  state.source = "empty";
  elements.fileInput.value = "";
  resetForecast();
  renderInput();
  setStatus("Data cleared. Upload a CSV to continue.");
}

function renderInput() {
  const count = state.values.length;
  elements.observationCount.textContent = `${count} observation${count === 1 ? "" : "s"}`;
  elements.valueHeader.textContent = elements.seriesName.value.trim() || "Value";

  elements.dataBadge.textContent =
    state.source === "sample" ? "Sample data" :
    state.source === "csv" ? "Uploaded CSV" :
    "No data";

  elements.dataBadge.className =
    state.source === "csv" ? "status-badge user" :
    state.source === "sample" ? "status-badge sample" :
    "status-badge";

  if (!count) {
    elements.inputTableBody.innerHTML =
      '<tr><td colspan="2" class="empty-cell">No observations loaded.</td></tr>';
    renderChart();
    return;
  }

  const previewLimit = 80;
  const rows = state.values.slice(0, previewLimit).map((value, index) => `
    <tr>
      <td>${escapeHtml(state.periods[index] || String(index + 1))}</td>
      <td>${escapeHtml(formatValue(value))}</td>
    </tr>
  `);

  if (count > previewLimit) {
    rows.push(`<tr><td colspan="2" class="empty-cell">Showing first ${previewLimit} of ${count} observations.</td></tr>`);
  }

  elements.inputTableBody.innerHTML = rows.join("");
  renderChart();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pointsToPath(points) {
  if (!points.length) return "";
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function renderChart() {
  const width = 920;
  const height = 300;
  const padX = 26;
  const padY = 22;

  const actual = state.values;
  const forecast = state.forecast;
  const all = [...actual, ...forecast];

  elements.chartTitle.textContent = elements.seriesName.value.trim() || "Series";

  if (!all.length) {
    elements.actualPath.setAttribute("d", "");
    elements.forecastPath.setAttribute("d", "");
    elements.splitLine.setAttribute("x1", "0");
    elements.splitLine.setAttribute("x2", "0");
    return;
  }

  let min = Math.min(...all);
  let max = Math.max(...all);
  const rawSpan = max - min;
  const padding = rawSpan === 0 ? Math.max(Math.abs(max) * 0.08, 1) : rawSpan * 0.1;
  min -= padding;
  max += padding;

  const totalSlots = Math.max(actual.length + forecast.length - 1, 1);
  const xFor = (index) => padX + (index / totalSlots) * (width - padX * 2);
  const yFor = (value) =>
    height - padY - ((value - min) / (max - min || 1)) * (height - padY * 2);

  const actualPoints = actual.map((value, index) => [xFor(index), yFor(value)]);
  const forecastPoints = [];

  if (actual.length) {
    forecastPoints.push([xFor(actual.length - 1), yFor(actual[actual.length - 1])]);
  }

  forecast.forEach((value, index) => {
    forecastPoints.push([xFor(actual.length + index), yFor(value)]);
  });

  elements.actualPath.setAttribute("d", pointsToPath(actualPoints));
  elements.forecastPath.setAttribute("d", pointsToPath(forecastPoints));

  const splitX = actual.length ? xFor(actual.length - 1) : 0;
  elements.splitLine.setAttribute("x1", String(splitX));
  elements.splitLine.setAttribute("x2", String(splitX));
}

function renderResults() {
  renderChart();

  if (!state.metrics || !state.forecast.length) {
    elements.metricLatest.textContent = state.values.length
      ? formatValue(state.values[state.values.length - 1])
      : "—";
    elements.metricEnd.textContent = "—";
    elements.metricChange.textContent = "—";
    elements.metricSlope.textContent = "—";
    elements.metricMae.textContent = "—";
    elements.metricR2.textContent = "—";
    elements.forecastCount.textContent = "No forecast yet";
    elements.forecastTableBody.innerHTML =
      '<tr><td colspan="2" class="empty-cell">Run a forecast to populate this table.</td></tr>';
    return;
  }

  const metrics = state.metrics;
  elements.metricLatest.textContent = formatValue(metrics.latest);
  elements.metricEnd.textContent = formatValue(metrics.forecastEnd);
  elements.metricChange.textContent =
    metrics.percentChange === null
      ? formatValue(metrics.absoluteChange)
      : `${metrics.percentChange >= 0 ? "+" : ""}${formatNumber(metrics.percentChange, 1)}%`;
  elements.metricSlope.textContent = formatValue(metrics.slopePerPeriod);
  elements.metricMae.textContent = formatValue(metrics.fitMae);
  elements.metricR2.textContent = formatNumber(metrics.rSquared, 3);

  elements.forecastCount.textContent =
    `${state.forecast.length} future period${state.forecast.length === 1 ? "" : "s"}`;

  elements.forecastTableBody.innerHTML = state.forecast
    .map(
      (value, index) => `
        <tr>
          <td>t+${index + 1}</td>
          <td>${escapeHtml(formatValue(value))}</td>
        </tr>
      `
    )
    .join("");
}

async function runForecast() {
  if (state.values.length < 3) {
    setStatus("Upload at least 3 observations before forecasting.", true);
    return;
  }

  const horizon = Number(elements.horizon.value);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 120) {
    setStatus("Forecast horizon must be an integer between 1 and 120.", true);
    return;
  }

  elements.forecastButton.disabled = true;
  elements.exportButton.disabled = true;
  setStatus("Running deterministic baseline…");

  try {
    const response = await fetch("/api/forecast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ series: state.values, horizon })
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Forecast request failed.");
    }

    state.forecast = Array.isArray(payload.forecast) ? payload.forecast : [];
    state.metrics = payload.metrics || null;
    state.metadata = payload.metadata || null;

    renderResults();
    elements.exportButton.disabled = state.forecast.length === 0;
    setStatus(
      `Forecast complete: ${state.forecast.length} future period${state.forecast.length === 1 ? "" : "s"} generated with the linear trend baseline.`
    );
  } catch (error) {
    resetForecast();
    setStatus(error instanceof Error ? error.message : "Forecast failed.", true);
  } finally {
    elements.forecastButton.disabled = false;
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportForecast() {
  if (!state.forecast.length) return;

  const rows = [["phase", "period", "value"]];
  state.values.forEach((value, index) => {
    rows.push(["actual", state.periods[index] || String(index + 1), value]);
  });
  state.forecast.forEach((value, index) => {
    rows.push(["forecast", `t+${index + 1}`, value]);
  });

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = (elements.seriesName.value.trim() || "financexai")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  anchor.href = url;
  anchor.download = `${safeName || "financexai"}-forecast.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

elements.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    setStatus("CSV files are limited to 2 MB in this milestone.", true);
    elements.fileInput.value = "";
    return;
  }

  try {
    const parsed = parseCsv(await file.text());
    state.periods = parsed.periods;
    state.values = parsed.values;
    state.source = "csv";
    elements.seriesName.value = parsed.name;
    resetForecast();
    renderInput();
    setStatus(`Loaded ${parsed.values.length} observations from ${file.name}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not parse the CSV.", true);
  }
});

elements.sampleButton.addEventListener("click", loadSample);
elements.clearButton.addEventListener("click", clearData);
elements.forecastButton.addEventListener("click", runForecast);
elements.exportButton.addEventListener("click", exportForecast);
elements.seriesName.addEventListener("input", () => {
  renderInput();
  renderResults();
});
elements.valueUnit.addEventListener("input", () => {
  renderInput();
  renderResults();
});

loadSample();
