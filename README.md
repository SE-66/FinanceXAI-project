# FinanceXAI

FinanceXAI is a financial time-series research workspace hosted on Cloudflare.

## Current milestone: TimesFM 3

The user-facing application is served by Cloudflare Workers Static Assets. Forecast requests are validated by the Worker and sent to a Cloudflare Container running Google TimesFM 3.

### Implemented

- CSV upload for ordered financial/time-series data
- automatic numeric-series detection
- configurable 1–120 step forecast horizon
- real model-backed TimesFM 3 forecast path
- TimesFM 10th–90th percentile quantiles
- history + forecast chart
- latest value, forecast-end value, projected change, and end-horizon uncertainty metrics
- forecast CSV export including P10/P90
- Cloudflare Worker API validation
- model health endpoint
- GitHub verification workflow
- no Supabase
- no Vercel
- no external database

## Architecture

```text
Browser
  |
  | static HTML/CSS/JS
  v
Cloudflare Worker + Static Assets
  |
  | /api/forecast
  v
Cloudflare Container
  |
  v
TimesFM 3
google/timesfm-3.0-pytorch
```

Endpoints:

- `GET /api/health` — FinanceXAI Worker configuration/status
- `GET /api/model/health` — starts/checks the TimesFM container
- `GET /api/forecast` — forecast API contract
- `POST /api/forecast` — TimesFM forecast

Example:

```json
{
  "series": [100, 105, 111, 118, 124],
  "horizon": 6
}
```

## TimesFM reference / mirror provenance

The project owner requested that FinanceXAI use:

`SE-66/SE-66-timesfm-research-workspace`

as the TimesFM reference.

That repository's current `main` branch is no longer the TimesFM application; it was replaced by a DevCloud project. The relevant historical TimesFM snapshot is pinned at:

`17dc87aaee41d96d214269b65e6fd211d4b636ee`

The historical implementation embedded an external Hugging Face forecasting Space and explicitly did not run the model locally. FinanceXAI uses that snapshot as provenance/reference rather than copying the later DevCloud source. The operational model adapter in this repository uses the official TimesFM package directly inside a Cloudflare Container.

See `mirrors/timesfm-research-workspace/README.md`.

## Model runtime

Container:

`timesfm-service/`

Pinned model package:

`timesfm[torch]==3.0.2`

Checkpoint:

`google/timesfm-3.0-pytorch`

The Docker build downloads the checkpoint into the container image. Runtime inference therefore does not require a separate hosted inference service.

The Worker does not silently fall back to the old linear baseline. If the model container is unavailable, the API returns an explicit error.

## License boundary

The TimesFM source code and the pretrained model weights have different license boundaries.

The TimesFM 3 pretrained weights are identified by the model provider as:

`timesfm-non-commercial-license-v1.0`

This integration must be treated as a **research / non-commercial model path** unless separate licensing clearance is obtained. FinanceXAI must not describe the model as commercially licensed.

## Cloudflare requirements

The frontend/Worker uses Workers Static Assets.

TimesFM inference uses Cloudflare Containers with:

- class: `TimesFMContainer`
- one maximum running instance
- `standard-2` instance type
- 1 vCPU
- 6 GiB memory
- 12 GB disk
- CPU inference
- 15-minute idle sleep

Cloudflare Containers require an eligible paid Workers setup.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Run repository checks:

```bash
npm run check
```

The checks include Node tests, JavaScript syntax checks, Python syntax compilation, and a Wrangler deployment dry-run.

## Deploy

```bash
npm run deploy
```

When GitHub is connected to Cloudflare Workers Builds, pushes to `main` can trigger the Worker and Container deployment.

## Verification rule

Source code, tests, or a successful Wrangler dry-run do not prove that the TimesFM model is live.

After Cloudflare deploys the container, verify:

1. `GET /api/health`
2. `GET /api/model/health`
3. `POST /api/forecast` with a numeric series
4. UI output and exported quantiles

Only then should the TimesFM path be called runtime-verified.
