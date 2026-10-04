import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [worker, wrangler, html, pkg, mirror] = await Promise.all([
  readFile(new URL("../src/index.js", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../mirrors/timesfm-research-workspace/README.md", import.meta.url), "utf8")
]);

test("FinanceXAI uses the open-source TimesFM Space execution boundary", () => {
  assert.match(worker, /hari31416-ts-foundation-lab\.hf\.space/);
  assert.match(worker, /executionMode: "external-open-source-space"/);
  assert.match(worker, /paidCloudflareServicesRequired: false/);
  assert.doesNotMatch(worker, /getContainer\(/);
  assert.doesNotMatch(worker, /@cloudflare\/containers/);
});

test("Wrangler is Free-Workers compatible and declares no containers", () => {
  assert.match(wrangler, /"assets"/);
  assert.doesNotMatch(wrangler, /"containers"/);
  assert.doesNotMatch(wrangler, /"durable_objects"/);
  assert.doesNotMatch(wrangler, /TimesFMContainer/);
});

test("package has no paid-container runtime dependency", () => {
  assert.doesNotMatch(pkg, /@cloudflare\/containers/);
  assert.doesNotMatch(pkg, /timesfm-service\/app\.py/);
});

test("UI embeds the live open-source TS Foundation Lab", () => {
  assert.match(html, /https:\/\/hari31416-ts-foundation-lab\.hf\.space/);
  assert.match(html, /Open-source TimesFM Lab/);
  assert.match(html, /external Hugging Face Space/);
  assert.doesNotMatch(html, /Cloudflare Container/);
});

test("requested research workspace provenance remains pinned", () => {
  assert.match(mirror, /SE-66\/SE-66-timesfm-research-workspace/);
  assert.match(mirror, /17dc87aaee41d96d214269b65e6fd211d4b636ee/);
});
