# FinanceXAI

FinanceXAI is a financial time-series research workspace hosted on Cloudflare Workers.

## Current milestone: free open-source TimesFM turnaround

FinanceXAI no longer requires Cloudflare Containers.

The user-facing application is served by Cloudflare Workers Static Assets. TimesFM execution is provided by the public open-source Hugging Face Space:

`hari31416/ts-foundation-lab`

FinanceXAI embeds that Space directly inside the application.

## Architecture

```text
Browser
  |
  | FinanceXAI HTML/CSS/JS
  v
Cloudflare Worker + Static Assets
  |
  | renders embedded model workspace
  v
Hugging Face Space
hari31416/ts-foundation-lab
  |
  v
Google TimesFM 3
```

Cloudflare remains the application host. The Hugging Face Space is a separate external execution and trust boundary.

## Why this path exists

Cloudflare Containers require a paid Workers entitlement. The previous container build was technically valid but could not be deployed on the current Free Workers account.

The free turnaround therefore returns to the execution boundary used by the original TimesFM research workspace: Cloudflare serves the outer application while TimesFM runs in an external open-source forecasting Space.

No paid Cloudflare Container is required by the current repository configuration.

## User workflow

1. Upload a financial/time-series CSV in FinanceXAI, or use the bundled sample.
2. Click **Download prepared CSV & open lab**.
3. FinanceXAI writes a simple `period,value`-style CSV and scrolls to the embedded TimesFM Lab.
4. Upload that CSV inside the embedded lab.
5. Select TimesFM-3 and configure the forecast horizon.
6. Run the forecast and inspect/download the result inside the embedded lab.

The cross-origin browser security boundary means FinanceXAI does not silently inject local files into the embedded Space.

## API endpoints

- `GET /api/health` — FinanceXAI runtime configuration.
- `GET /api/model/health` — checks reachability of the external open-source Space.
- `GET /api/forecast` — describes the current forecast execution contract.
- `POST /api/forecast` — intentionally returns an explicit error because direct JSON-to-model inference is not implemented in this free turnaround.

This prevents FinanceXAI from claiming that a local Worker API is executing TimesFM when the actual execution happens in the embedded external Space.

## TimesFM reference / mirror provenance

The project owner requested that FinanceXAI use:

`SE-66/SE-66-timesfm-research-workspace`

as the TimesFM reference.

The relevant historical TimesFM snapshot is pinned at:

`17dc87aaee41d96d214269b65e6fd211d4b636ee`

That snapshot explicitly embedded:

`https://hari31416-ts-foundation-lab.hf.space`

and treated Hugging Face as the model-execution boundary.

See:

`mirrors/timesfm-research-workspace/README.md`

## License boundary

The TimesFM source code and pretrained model weights have separate license boundaries.

TimesFM 3 pretrained weights are distributed under:

`timesfm-non-commercial-license-v1.0`

Treat this integration as a research / non-commercial path unless separate licensing clearance is obtained.

The external Space is separately maintained and can change, sleep, queue, or become unavailable independently of FinanceXAI.

## Development

Requires Node.js and npm.

```bash
npm run dev
```

Run checks:

```bash
npm test
npm run check
```

`npm run check` runs the repository tests, JavaScript syntax checks, and a Wrangler deployment dry-run.

## Deploy

```bash
npm run deploy
```

The current `wrangler.jsonc` contains only the Worker and Static Assets configuration. It declares no Containers or Durable Objects.

## Verification rule

A successful FinanceXAI deployment proves the Cloudflare application is live, not that the external model service is permanently available.

For runtime verification:

1. Check `GET /api/health`.
2. Check `GET /api/model/health`.
3. Open the embedded TimesFM Lab.
4. Run a real forecast inside the Space.

Only then should the full open-source forecast path be called runtime-verified.
