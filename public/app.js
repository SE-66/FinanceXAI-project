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
  source: "sample"
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  prepareButton: document.querySelector("#prepareButton"),
  seriesName: document.querySelector("#seriesName"),
  valueUnit: document.querySelector("#valueUnit"),
  status: document.querySelector("#status"),
  dataBadge: document.querySelector("#dataBadge"),
  observationCount: document.querySelector("#observationCount"),
  valueHeader: document.querySelector("#valueHeader"),
  inputTableBody: document.querySelector("#inputTableBody"),
  timesfmLab: document.querySelector("#timesfmLab")
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadSample() {
  state.periods = [...sample.periods];
  state.values = [...sample.values];
  state.source = "sample";
  elements.seriesName.value = sample.name;
  elements.valueUnit.value = sample.unit;
  elements.fileInput.value = "";
  renderInput();
  setStatus("Ready. Sample data is loaded.");
}

function clearData() {
  state.periods = [];
  state.values = [];
  state.source = "empty";
  elements.fileInput.value = "";
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

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadPreparedCsv() {
  if (state.values.length < 3) {
    throw new Error("Load at least 3 observations before preparing a TimesFM CSV.");
  }

  const rows = [["period", elements.seriesName.value.trim() || "value"]];
  state.values.forEach((value, index) => {
    rows.push([state.periods[index] || String(index + 1), value]);
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
  anchor.download = `${safeName || "financexai"}-timesfm-input.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function prepareAndOpenLab() {
  try {
    downloadPreparedCsv();
    setStatus("Prepared CSV downloaded. Upload it in the TimesFM Lab below, choose TimesFM-3, set the horizon, and run the forecast.");
    elements.timesfmLab.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not prepare the CSV.", true);
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
    renderInput();
    setStatus(`Loaded ${parsed.values.length} observations from ${file.name}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not parse the CSV.", true);
  }
});

elements.sampleButton.addEventListener("click", loadSample);
elements.clearButton.addEventListener("click", clearData);
elements.prepareButton.addEventListener("click", prepareAndOpenLab);
elements.seriesName.addEventListener("input", renderInput);
elements.valueUnit.addEventListener("input", renderInput);

loadSample();
