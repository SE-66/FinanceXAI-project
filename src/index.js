import { Container, getContainer } from "@cloudflare/containers";
import { normalizeHorizon, normalizeSeries } from "./forecast.js";

export class TimesFMContainer extends Container {
  defaultPort = 8000;
  sleepAfter = "15m";
  enableInternet = false;
}

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

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getTimesFM(env) {
  return getContainer(env.TIMESFM, "financexai-timesfm");
}

async function handleModelHealth(env) {
  try {
    const response = await getTimesFM(env).fetch(
      new Request("http://timesfm/health", { method: "GET" })
    );
    const payload = await readJson(response);

    if (!response.ok) {
      return errorResponse(
        payload?.detail || payload?.error || "TimesFM health check failed.",
        503,
        { upstreamStatus: response.status }
      );
    }

    return json(payload);
  } catch (error) {
    return errorResponse(
      "TimesFM container is not available.",
      503,
      { detail: error instanceof Error ? error.message : "Container startup failed." }
    );
  }
}

async function handleForecast(request, env) {
  if (request.method === "GET") {
    return json({
      endpoint: "/api/forecast",
      method: "POST",
      contentType: "application/json",
      engine: "timesfm-3.0",
      model: "google/timesfm-3.0-pytorch",
      runtime: "cloudflare-container",
      modelLicense: "timesfm-non-commercial-license-v1.0",
      request: {
        series: [100, 105, 111, 118, 124],
        horizon: 6
      },
      limits: {
        minimumObservations: 3,
        maximumObservations: 5000,
        horizon: {
          minimum: 1,
          maximum: 120
        }
      }
    });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405, {}, {
      allow: "GET, POST"
    });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse("Content-Type must be application/json.", 415);
  }

  const lengthHeader = Number(request.headers.get("content-length"));
  if (Number.isFinite(lengthHeader) && lengthHeader > 262144) {
    return errorResponse("Request body is too large.", 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must contain valid JSON.", 400);
  }

  let series;
  let horizon;

  try {
    series = normalizeSeries(body.series);
    horizon = normalizeHorizon(body.horizon);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid forecast input.",
      400
    );
  }

  try {
    const upstream = await getTimesFM(env).fetch(
      new Request("http://timesfm/forecast", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ series, horizon })
      })
    );

    const payload = await readJson(upstream);

    if (!upstream.ok) {
      return errorResponse(
        payload?.detail || payload?.error || "TimesFM inference failed.",
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
        {
          engine: "timesfm-3.0",
          upstreamStatus: upstream.status
        }
      );
    }

    if (!payload || !Array.isArray(payload.forecast)) {
      return errorResponse("TimesFM returned an invalid response.", 502);
    }

    return json(payload);
  } catch (error) {
    return errorResponse(
      "TimesFM container is unavailable.",
      503,
      {
        engine: "timesfm-3.0",
        detail: error instanceof Error ? error.message : "Container request failed."
      }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return errorResponse("Method not allowed.", 405, {}, {
          allow: "GET"
        });
      }

      return json({
        ok: true,
        service: "FinanceXAI",
        runtime: "cloudflare-workers",
        forecastEngine: "timesfm-3.0",
        inferenceRuntime: "cloudflare-container",
        model: "google/timesfm-3.0-pytorch",
        modelHealthEndpoint: "/api/model/health",
        modelLicense: "timesfm-non-commercial-license-v1.0"
      });
    }

    if (url.pathname === "/api/model/health") {
      if (request.method !== "GET") {
        return errorResponse("Method not allowed.", 405, {}, {
          allow: "GET"
        });
      }
      return handleModelHealth(env);
    }

    if (url.pathname === "/api/forecast") {
      return handleForecast(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
