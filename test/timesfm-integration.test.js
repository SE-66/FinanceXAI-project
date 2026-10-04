import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, wrangler, html, app, pkg, mirror] = await Promise.all([
  readFile(new URL("../src/index.js", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../mirrors/timesfm-research-workspace/README.md", import.meta.url), "utf8")
]);

test("FinanceXAI keeps the free external TimesFM execution boundary", () => {
  assert.match(worker, /hari31416-ts-foundation-lab\.hf\.space/);
  assert.match(worker, /paidCloudflareServicesRequired: false/);
  assert.doesNotMatch(worker, /getContainer\(/);
  assert.doesNotMatch(worker, /@cloudflare\/containers/);
});

test("Wrangler is Free-Workers compatible and retires the old Durable Object", () => {
  assert.match(wrangler, /"assets"/);
  assert.doesNotMatch(wrangler, /"containers"/);
  assert.doesNotMatch(wrangler, /"durable_objects"/);
  assert.match(wrangler, /"tag": "v1"[\s\S]*"new_sqlite_classes": \["TimesFMContainer"\]/);
  assert.match(wrangler, /"tag": "v2"[\s\S]*"deleted_classes": \["TimesFMContainer"\]/);
});

test("package has no paid-container runtime dependency", () => {
  assert.doesNotMatch(pkg, /@cloudflare\/containers/);
  assert.doesNotMatch(pkg, /timesfm-service\/app\.py/);
});

test("native UI uses Gradio client instead of embedding the Space dashboard", () => {
  assert.match(app, /@gradio\/client@2\.7\.1/);
  assert.match(app, /Client\.connect\(SPACE_ID/);
  assert.match(app, /"\/on_file_uploaded"/);
  assert.match(app, /"\/run_forecast_pipeline"/);
  assert.match(app, /"TimesFM-3 \(Zero-Shot\)"/);
  assert.doesNotMatch(html, /<iframe/i);
  assert.match(html, /Run TimesFM forecast/);
  assert.match(html, /TimesFM result/);
});

test("requested research workspace provenance remains pinned", () => {
  assert.match(mirror, /SE-66\/SE-66-timesfm-research-workspace/);
  assert.match(mirror, /17dc87aaee41d96d214269b65e6fd211d4b636ee/);
});
