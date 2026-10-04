import {
  Client,
  handle_file
} from "https://cdn.jsdelivr.net/npm/@gradio/client@2.7.1/dist/index.min.js";

const SPACE_ID = "hari31416/ts-foundation-lab";
const SPACE_ORIGIN = "https://hari31416-ts-foundation-lab.hf.space";
const REQUIRED_ENDPOINTS = ["/on_file_uploaded", "/run_forecast_pipeline"];

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
  source: "sample",
  client: null,
  apiInfo: null,
  predictionUrl: null
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  seriesName: document.querySelector("#seriesName"),
  valueUnit: document.querySelector("#valueUnit"),
  horizon: document.querySelector("#horizon"),
  context: document.querySelector("#context"),
  backtest: document.querySelector("#backtest"),
  forecastButton: document.querySelector("#forecastButton"),
  status: document.querySelector("#status"),
  dataBadge: document.querySelector("#dataBadge"),
  modelStatusBadge: document.querySelector("#modelStatusBadge"),
  observationCount: document.querySelector("#observationCount"),
  valueHeader: document.querySelector("#valueHeader"),
  inputTableBody: document.querySelector("#inputTableBody"),
  resultState: document.querySelector("#resultState"),
  metricsWrap: document.querySelector("#metricsWrap"),
  metricsTable: document.querySelector("#metricsTable"),
  predictionsWrap: document.querySelector("#predictionsWrap"),
  predictionsTable: document.querySelector("#predictionsTable"),
  predictionCount: document.querySelector("#predictionCount"),
  predictionDownload: document.querySelector("#predictionDownload"),
  executionDetails: document.querySelector("#executionDetails")
};

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", error);
}

function setModelStatus(message, kind = "") {
  elements.modelStatusBadge.textContent = message;
  elements.modelStatusBadge.className = "status-badge";
  if (kind) elements.modelStatusBadge.classList.add(kind);
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
    index !== valueColumn && /^(period|date|time|timestamp|month|quarter|week|year)$/i.test(header.trim())
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

function parseCsvTable(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return { headers: [], rows: [] };

  const rows = lines.map(parseCsvLine);
  return {
    headers: rows[0],
    rows: rows.slice(1)
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function loadSample() {
  state.periods = [...sample.periods];
  state.values = [...sample.values];
  state.source = "sample";
  elements.seriesName.value = sample.name;
  elements.valueUnit.value = sample.unit;
  elements.fileInput.value = "";
  clearResults();
  renderInput();
  setStatus("Ready. Sample data is loaded.");
}

function clearData() {
  state.periods = [];
  state.values = [];
  state.source = "empty";
  elements.fileInput.value = "";
  clearResults();
  renderInput();
  setStatus("Data cleared. Upload a CSV or reload the sample.");
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
}

function clearResults() {
  state.predictionUrl = null;
  elements.resultState.hidden = false;
  elements.resultState.classList.remove("error-state", "success-state");
  elements.resultState.innerHTML =
    "<strong>No forecast yet</strong><p>Run TimesFM to populate model metrics and prediction output here.</p>";
  elements.metricsWrap.hidden = true;
  elements.predictionsWrap.hidden = true;
  elements.metricsTable.innerHTML = "";
  elements.predictionsTable.innerHTML = "";
  elements.predictionCount.textContent = "—";
  elements.predictionDownload.href = "#";
  elements.predictionDownload.removeAttribute("download");
  elements.predictionDownload.classList.add("disabled-link");
  elements.predictionDownload.setAttribute("aria-disabled", "true");
  elements.executionDetails.textContent = "No execution yet.";
}

function makeTimesFmCsv() {
  const targetName = (elements.seriesName.value.trim() || "value")
    .replace(/[\r\n,]+/g, " ")
    .trim() || "value";

  const rows = [["period", targetName]];
  state.values.forEach((value, index) => {
    rows.push([state.periods[index] || String(index + 1), value]);
  });

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function unwrapComponentValue(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return value.value;
  }
  return value;
}

function normalizeList(value) {
  const unwrapped = unwrapComponentValue(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return [];
  return [unwrapped];
}

function normalizeTable(value) {
  if (!value) return null;

  if (value.value) {
    const nested = normalizeTable(value.value);
    if (nested) return nested;
  }

  if (Array.isArray(value)) {
    if (!value.length) return { headers: [], rows: [] };
    if (Array.isArray(value[0])) {
      return { headers: [], rows: value };
    }
  }

  if (typeof value === "object") {
    const data = Array.isArray(value.data) ? value.data : null;
    const headers = Array.isArray(value.headers) ? value.headers : [];

    if (data) return { headers, rows: data };

    if (value.data && typeof value.data === "object") {
      const nested = normalizeTable(value.data);
      if (nested) return nested;
    }
  }

  return null;
}

function renderTable(table, target, emptyMessage) {
  if (!table || !table.rows.length) {
    target.innerHTML = `<tbody><tr><td class="empty-cell">${escapeHtml(emptyMessage)}</td></tr></tbody>`;
    return;
  }

  const width = Math.max(
    table.headers.length,
    ...table.rows.map((row) => Array.isArray(row) ? row.length : 0)
  );

  const headers = table.headers.length
    ? table.headers
    : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);

  target.innerHTML = `
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${table.rows.slice(0, 200).map((row) => `
        <tr>
          ${Array.from({ length: width }, (_, index) =>
            `<td>${escapeHtml(Array.isArray(row) ? row[index] : "")}</td>`
          ).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function extractFileUrl(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return new URL(value, SPACE_ORIGIN).href;
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFileUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const key of ["url", "path", "data", "value"]) {
      const found = extractFileUrl(value[key]);
      if (found) return found;
    }
  }

  return null;
}

async function getTimesFmClient() {
  if (state.client) return state.client;

  setModelStatus("Connecting…");
  setStatus("Connecting to the open-source TimesFM Space…");

  const client = await Client.connect(SPACE_ID, {
    events: ["data", "status"]
  });

  const apiInfo = await client.view_api();
  const named = apiInfo?.named_endpoints || {};
  const missing = REQUIRED_ENDPOINTS.filter((endpoint) => !named[endpoint]);

  if (missing.length) {
    throw new Error(
      `The upstream TimesFM Space API changed. Missing endpoint${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
    );
  }

  state.client = client;
  state.apiInfo = apiInfo;
  setModelStatus("API ready", "sample");
  return client;
}

async function runSubmission(client, endpoint, payload) {
  const submission = client.submit(endpoint, payload);
  let finalData = null;

  for await (const message of submission) {
    if (message.type === "status") {
      const stage = message.stage || "processing";
      const position = Number.isFinite(message.position)
        ? ` · queue position ${message.position + 1}`
        : "";
      const eta = Number.isFinite(message.eta)
        ? ` · ETA ${Math.max(0, Math.round(message.eta))}s`
        : "";
      setStatus(`TimesFM: ${stage}${position}${eta}`);
    }

    if (message.type === "data") {
      finalData = message.data;
    }
  }

  return finalData;
}

async function loadPredictionCsv(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Prediction CSV returned HTTP ${response.status}.`);
  }
  return parseCsvTable(await response.text());
}

function showExecutionError(message, details = {}) {
  elements.resultState.hidden = false;
  elements.resultState.classList.remove("success-state");
  elements.resultState.classList.add("error-state");
  elements.resultState.innerHTML =
    `<strong>TimesFM execution failed</strong><p>${escapeHtml(message)}</p>`;
  elements.executionDetails.textContent = JSON.stringify(details, null, 2);
  setStatus(message, true);
  setModelStatus("API error");
}

async function runForecast() {
  if (state.values.length < 3) {
    setStatus("Load at least 3 observations before forecasting.", true);
    return;
  }

  const horizon = Number(elements.horizon.value);
  const context = Number(elements.context.value);
  const backtest = elements.backtest.checked;

  if (backtest && state.values.length <= horizon) {
    setStatus(
      `Backtest mode needs more than ${horizon} observations. Add more data or turn backtest off.`,
      true
    );
    return;
  }

  clearResults();
  elements.forecastButton.disabled = true;

  try {
    const client = await getTimesFmClient();
    const csv = makeTimesFmCsv();
    const uploadFile = new File(
      [csv],
      "financexai-timesfm-input.csv",
      { type: "text/csv" }
    );

    setStatus("Uploading the prepared series to TimesFM…");
    const uploadResult = await client.predict(
      "/on_file_uploaded",
      [handle_file(uploadFile)]
    );

    const uploadData = Array.isArray(uploadResult?.data) ? uploadResult.data : [];

    if (uploadData.length < 5) {
      throw new Error("The TimesFM upload endpoint returned an unexpected response.");
    }

    const timestampColumn = unwrapComponentValue(uploadData[0]) ?? null;
    const targetColumn = unwrapComponentValue(uploadData[1]);

    if (!targetColumn) {
      throw new Error("TimesFM could not detect the numeric target column.");
    }

    const pastCovariates = normalizeList(uploadData[2]);
    const futureCovariates = normalizeList(uploadData[3]);
    const uploadStatus = String(unwrapComponentValue(uploadData[4]) ?? "");

    if (/^error/i.test(uploadStatus.trim())) {
      throw new Error(uploadStatus);
    }

    setStatus("TimesFM accepted the dataset. Starting model inference…");

    const resultData = await runSubmission(
      client,
      "/run_forecast_pipeline",
      [
        timestampColumn,
        targetColumn,
        pastCovariates,
        futureCovariates,
        context,
        horizon,
        ["TimesFM-3 (Zero-Shot)"],
        backtest
      ]
    );

    if (!Array.isArray(resultData) || resultData.length < 4) {
      throw new Error("The TimesFM forecast endpoint returned an unexpected response.");
    }

    const metricsValue = resultData[1];
    const predictionFile = resultData[2];
    const executionStatus = String(unwrapComponentValue(resultData[3]) ?? "");

    if (/^error\s*:/i.test(executionStatus.trim())) {
      throw new Error(executionStatus.replace(/^error\s*:\s*/i, ""));
    }

    const metrics = normalizeTable(metricsValue);
    if (metrics && metrics.rows.length) {
      renderTable(metrics, elements.metricsTable, "No metrics returned.");
      elements.metricsWrap.hidden = false;
    }

    const predictionUrl = extractFileUrl(predictionFile);
    let predictionRows = 0;
    let predictionLoadError = null;

    if (predictionUrl) {
      state.predictionUrl = predictionUrl;
      elements.predictionDownload.href = predictionUrl;
      elements.predictionDownload.target = "_blank";
      elements.predictionDownload.rel = "noreferrer";
      elements.predictionDownload.classList.remove("disabled-link");
      elements.predictionDownload.setAttribute("aria-disabled", "false");

      try {
        const predictions = await loadPredictionCsv(predictionUrl);
        predictionRows = predictions.rows.length;
        renderTable(
          predictions,
          elements.predictionsTable,
          "The prediction file contained no rows."
        );
        elements.predictionCount.textContent =
          `${predictionRows} row${predictionRows === 1 ? "" : "s"}`;
        elements.predictionsWrap.hidden = false;
      } catch (error) {
        predictionLoadError = error instanceof Error ? error.message : "Could not preview prediction CSV.";
      }
    }

    elements.resultState.hidden = false;
    elements.resultState.classList.remove("error-state");
    elements.resultState.classList.add("success-state");
    elements.resultState.innerHTML = `
      <strong>TimesFM forecast completed</strong>
      <p>${escapeHtml(executionStatus || "The upstream model completed successfully.")}</p>
    `;

    elements.executionDetails.textContent = JSON.stringify({
      space: SPACE_ID,
      endpoint: "/run_forecast_pipeline",
      model: "TimesFM-3 (Zero-Shot)",
      observations: state.values.length,
      horizon,
      context,
      backtest,
      detectedTimestampColumn: timestampColumn,
      detectedTargetColumn: targetColumn,
      uploadStatus,
      executionStatus,
      predictionRows,
      predictionPreviewError: predictionLoadError
    }, null, 2);

    setStatus(
      predictionLoadError
        ? `TimesFM completed. The prediction file is available for download, but its in-page preview could not be loaded: ${predictionLoadError}`
        : "TimesFM completed successfully. Results are shown below."
    );
    setModelStatus("TimesFM ready", "sample");
  } catch (error) {
    const message = error instanceof Error ? error.message : "TimesFM request failed.";
    showExecutionError(message, {
      space: SPACE_ID,
      model: "TimesFM-3 (Zero-Shot)",
      observations: state.values.length,
      horizon,
      context,
      backtest
    });
  } finally {
    elements.forecastButton.disabled = false;
  }
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
    clearResults();
    renderInput();
    setStatus(`Loaded ${parsed.values.length} observations from ${file.name}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not parse the CSV.", true);
  }
});

elements.sampleButton.addEventListener("click", loadSample);
elements.clearButton.addEventListener("click", clearData);
elements.forecastButton.addEventListener("click", runForecast);
elements.seriesName.addEventListener("input", renderInput);
elements.valueUnit.addEventListener("input", renderInput);
elements.predictionDownload.addEventListener("click", (event) => {
  if (!state.predictionUrl) event.preventDefault();
});

loadSample();
