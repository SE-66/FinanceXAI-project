import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, wrangler, html, service, mirror] = await Promise.all([
  readFile(new URL("../src/index.js", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../timesfm-service/app.py", import.meta.url), "utf8"),
  readFile(new URL("../mirrors/timesfm-research-workspace/README.md", import.meta.url), "utf8")
]);

test("FinanceXAI routes forecasts to a TimesFM Cloudflare Container", () => {
  assert.match(worker, /getContainer\(env\.TIMESFM/);
  assert.match(worker, /engine: "timesfm-3\.0"/);
  assert.match(worker, /google\/timesfm-3\.0-pytorch/);
  assert.doesNotMatch(worker, /linearTrendForecast\(body\.series/);
});

test("Wrangler declares the TimesFM container and durable object", () => {
  assert.match(wrangler, /"class_name": "TimesFMContainer"/);
  assert.match(wrangler, /"instance_type": "standard-2"/);
  assert.match(wrangler, /"name": "TIMESFM"/);
  assert.match(wrangler, /"new_sqlite_classes": \["TimesFMContainer"\]/);
});

test("TimesFM service uses the official TimesFM 3 model path", () => {
  assert.match(service, /TimesFM3Evaluator/);
  assert.match(service, /google\/timesfm-3\.0-pytorch/);
  assert.match(service, /return_quantiles=True/);
  assert.match(service, /timesfm-non-commercial-license-v1\.0/);
});

test("UI identifies the model and license boundary", () => {
  assert.match(html, /Google TimesFM 3/);
  assert.match(html, /Cloudflare Container/);
  assert.match(html, /timesfm-non-commercial-license-v1\.0/);
});

test("requested research workspace provenance is pinned", () => {
  assert.match(mirror, /SE-66\/SE-66-timesfm-research-workspace/);
  assert.match(mirror, /17dc87aaee41d96d214269b65e6fd211d4b636ee/);
});
