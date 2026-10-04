import { linearTrendForecast } from "./forecast.js";

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

function errorResponse(message, status, extraHeaders = {}) {
  return json({ error: message }, status, extraHeaders);
}

async function handleForecast(request) {
  if (request.method === "GET") {
    return json({
      endpoint: "/api/forecast",
      method: "POST",
      contentType: "application/json",
      engine: "linear-trend-baseline-v1",
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
    return errorResponse("Method not allowed.", 405, {
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

  try {
    return json(linearTrendForecast(body.series, body.horizon));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Invalid forecast input.",
      400
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return errorResponse("Method not allowed.", 405, {
          allow: "GET"
        });
      }

      return json({
        ok: true,
        service: "FinanceXAI",
        runtime: "cloudflare-workers",
        forecastEngine: "linear-trend-baseline-v1"
      });
    }

    if (url.pathname === "/api/forecast") {
      return handleForecast(request);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || request.method !== "GET") {
      return assetResponse;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
  }
};
