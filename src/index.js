const TIMESFM_SPACE_URL = "https://hari31416-ts-foundation-lab.hf.space";
const TIMESFM_SPACE_PAGE = "https://huggingface.co/spaces/hari31416/ts-foundation-lab";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function errorResponse(message, status, extra = {}, extraHeaders = {}) {
  return json({ error: message, ...extra }, status, extraHeaders);
}

async function handleModelHealth() {
  try {
    const response = await fetch(TIMESFM_SPACE_URL, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000)
    });

    return json({
      ok: response.ok,
      service: "FinanceXAI",
      engine: "timesfm-3.0",
      executionMode: "external-open-source-space",
      provider: "Hugging Face Space",
      space: TIMESFM_SPACE_PAGE,
      reachable: response.ok,
      upstreamStatus: response.status
    }, response.ok ? 200 : 503);
  } catch (error) {
    return errorResponse(
      "Open-source TimesFM Space is currently unreachable.",
      503,
      {
        engine: "timesfm-3.0",
        executionMode: "external-open-source-space",
        space: TIMESFM_SPACE_PAGE,
        detail: error instanceof Error ? error.message : "Upstream request failed."
      }
    );
  }
}

function forecastContract() {
  return {
    endpoint: "/api/forecast",
    engine: "timesfm-3.0",
    executionMode: "browser-gradio-client",
    provider: "Hugging Face Space",
    space: TIMESFM_SPACE_PAGE,
    spaceRuntimeUrl: TIMESFM_SPACE_URL,
    directJsonForecastApi: false,
    browserClient: "@gradio/client",
    instructions: [
      "Prepare or upload a CSV in FinanceXAI.",
      "FinanceXAI connects to the public Space through the Gradio browser client.",
      "FinanceXAI sends the prepared CSV to the on_file_uploaded endpoint.",
      "FinanceXAI invokes run_forecast_pipeline with TimesFM-3.",
      "FinanceXAI renders returned metrics and prediction files natively."
    ],
    note: "The free turnaround uses the public open-source Space API as the model-execution boundary. The Cloudflare Worker does not run TimesFM itself."
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return errorResponse("Method not allowed.", 405, {}, { allow: "GET" });
      }

      return json({
        ok: true,
        service: "FinanceXAI",
        runtime: "cloudflare-workers",
        forecastEngine: "timesfm-3.0",
        inferenceRuntime: "browser-gradio-client-to-open-source-space",
        provider: "Hugging Face Space",
        space: TIMESFM_SPACE_PAGE,
        cloudflareContainers: false,
        paidCloudflareServicesRequired: false,
        modelLicense: "timesfm-non-commercial-license-v1.0"
      });
    }

    if (url.pathname === "/api/model/health") {
      if (request.method !== "GET") {
        return errorResponse("Method not allowed.", 405, {}, { allow: "GET" });
      }
      return handleModelHealth();
    }

    if (url.pathname === "/api/forecast") {
      if (request.method === "GET") {
        return json(forecastContract());
      }

      if (request.method === "POST") {
        return errorResponse(
          "Direct Worker-side JSON forecasting is not enabled. The FinanceXAI browser uses the Gradio client to call the public TimesFM Space.",
          409,
          forecastContract()
        );
      }

      return errorResponse("Method not allowed.", 405, {}, { allow: "GET, POST" });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
