# FinanceXAI

FinanceXAI is a financial time-series research workspace hosted on Cloudflare Workers.

## Current milestone: native FinanceXAI UI with open-source TimesFM execution

FinanceXAI does not require Cloudflare Containers.

The application UI and result rendering are native FinanceXAI code served by Cloudflare Workers Static Assets. Model execution is supplied by the public Hugging Face Space:

`hari31416/ts-foundation-lab`

FinanceXAI connects to that Space programmatically using Gradio's open-source JavaScript client instead of embedding the third-party dashboard.

## Architecture

```text
FinanceXAI browser
  |
  | native CSV controls / horizon / context / results
  v
@gradio/client
  |
  | /on_file_uploaded
  | /run_forecast_pipeline
  v
Hugging Face Space
hari31416/ts-foundation-lab
  |
  v
Google TimesFM 3
```

Cloudflare remains the FinanceXAI application host. Hugging Face remains a separate model-execution and trust boundary.

## Why this path exists

Cloudflare Containers require a paid Workers entitlement. The prior container image was technically valid, but deployment could not complete on the current Free Workers account.

The first free workaround embedded the entire Gradio dashboard in an iframe. That exposed upstream Gradio plot/component errors directly inside FinanceXAI.

The current implementation removes that iframe. FinanceXAI now calls the Space through Gradio's JavaScript client and renders the returned model metrics and prediction CSV natively.

## Forecast workflow

1. Upload a time-series CSV in FinanceXAI, or use the bundled sample.
2. Choose a supported TimesFM forecast horizon and context length.
3. Optionally enable backtest mode.
4. Click **Run TimesFM forecast**.
5. FinanceXAI creates a two-column CSV in memory.
6. The browser Gradio client uploads it to `/on_file_uploaded`.
7. The same stateful Gradio client invokes `/run_forecast_pipeline` with **TimesFM-3 (Zero-Shot)**.
8. FinanceXAI displays the returned metrics and prediction file natively.

The Gradio client maintains the Space's `gr.State` session between the upload and forecast calls.

## External browser dependency

The frontend imports a pinned browser build of:

`@gradio/client@2.7.1`

from jsDelivr.

This is required because the Space runs on Hugging Face's Zero infrastructure and the browser Gradio client handles the hosted Space session/API protocol.

## Cloudflare endpoints

- `GET /api/health` — FinanceXAI runtime/configuration.
- `GET /api/model/health` — checks reachability of the external Space.
- `GET /api/forecast` — documents the current browser-client forecast contract.
- `POST /api/forecast` — intentionally does not proxy inference through the Worker; model calls are made from the browser Gradio client.

## TimesFM reference provenance

The project owner requested that FinanceXAI use:

`SE-66/SE-66-timesfm-research-workspace`

as the TimesFM reference.

The relevant historical snapshot remains pinned at:

`17dc87aaee41d96d214269b65e6fd211d4b636ee`

See:

`mirrors/timesfm-research-workspace/README.md`

## License boundary

TimesFM source code and pretrained weights have separate license boundaries.

TimesFM 3 pretrained weights are distributed under:

`timesfm-non-commercial-license-v1.0`

Treat this integration as a research / non-commercial path unless separate licensing clearance is obtained.

## Development

```bash
npm run dev
```

Run checks:

```bash
npm test
npm run check
```

The checks cover request validation, native Gradio client integration invariants, JavaScript syntax, and a Wrangler deployment dry-run.

## Deploy

```bash
npm run deploy
```

The current Wrangler configuration has no active Containers or Durable Object bindings. It retains the historical migration entries needed to delete the previously provisioned `TimesFMContainer` class.

## Runtime verification

A successful Cloudflare deploy proves FinanceXAI is live. Full forecast verification additionally requires a successful browser call to the public Space.

Verify:

1. `GET /api/health`
2. `GET /api/model/health`
3. Open FinanceXAI
4. Click **Run TimesFM forecast**
5. Confirm the result card shows completion, metrics, and/or a predictions download

If the upstream Space changes its API endpoints, FinanceXAI reports the missing endpoint instead of showing a generic embedded-component error.
