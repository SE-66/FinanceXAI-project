# FinanceXAI

FinanceXAI is a Cloudflare-native financial forecasting workspace.

## Current milestone

This repository starts from scratch. The first milestone provides:

- CSV upload for ordered financial/time-series data
- manual sample-data reset
- deterministic linear-trend forecast baseline
- configurable forecast horizon
- latest value, forecast-end value, projected change, slope, fit MAE, and R²
- history + forecast chart
- forecast CSV export
- Cloudflare Worker API with server-side validation
- Cloudflare Workers Static Assets for the frontend

The baseline is intentionally **not** labeled as AI. It gives FinanceXAI a transparent, testable forecasting path before adding a Cloudflare-hosted AI/model capability.

## Architecture

```
Browser
  |
  | static HTML/CSS/JS
  v
Cloudflare Worker + Static Assets
  |
  +-- /api/health
  +-- /api/forecast
```

Current infrastructure scope:

- Source control: GitHub
- Runtime / hosting: Cloudflare Workers
- Static assets: Cloudflare Workers Static Assets
- External database: none
- External API: none
- External hosting: none

## Local development

Requires Node.js and npm.

```bash
npm run dev
```

The scripts invoke a pinned Wrangler version with `npx`.

## Validation

```bash
npm test
npm run check
```

`npm run check` runs the tests and a Cloudflare deploy dry run.

## Deploy

```bash
npm run deploy
```

For Git-connected deployment, connect this GitHub repository to Cloudflare Workers Builds and use the same deploy command.

## Status

Code in this repository is the source of truth. A feature should not be described as deployed or production-verified until Cloudflare deployment and runtime checks have actually succeeded.
