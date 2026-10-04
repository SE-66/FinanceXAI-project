import os
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from timesfm3 import ModelConfig, TimesFM3Evaluator

MODEL_PATH = os.getenv("TIMESFM_MODEL_PATH", "/models/timesfm")
DEVICE = os.getenv("TIMESFM_DEVICE", "cpu")
MODEL_ID = "google/timesfm-3.0-pytorch"
QUANTILES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

app = FastAPI(title="FinanceXAI TimesFM Service", version="1.0.0")


class ForecastRequest(BaseModel):
    series: list[float] = Field(min_length=3, max_length=5000)
    horizon: int = Field(default=12, ge=1, le=120)


@lru_cache(maxsize=1)
def get_model():
    config = ModelConfig(
        checkpoint_path=MODEL_PATH,
        per_core_batch_size=1,
        device=DEVICE,
    )
    return TimesFM3Evaluator(config)


def percent_change(start: float, end: float):
    if start == 0:
        return None
    return ((end - start) / abs(start)) * 100.0


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "financexai-timesfm",
        "engine": "timesfm-3.0",
        "model": MODEL_ID,
        "device": DEVICE,
        "modelLoaded": get_model.cache_info().currsize > 0,
        "license": "timesfm-non-commercial-license-v1.0",
    }


@app.post("/forecast")
def forecast(body: ForecastRequest):
    values = np.asarray(body.series, dtype=np.float32)

    if not np.isfinite(values).all():
        raise HTTPException(status_code=400, detail="Every observation must be finite.")

    try:
        output = list(
            get_model().predict_batch(
                [values],
                horizon=body.horizon,
                return_quantiles=True,
                use_symmetric_averaging=False,
            )
        )[0]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TimesFM inference failed: {exc}") from exc

    point = np.asarray(output.forecast, dtype=float)
    quantiles = (
        np.asarray(output.quantiles, dtype=float)
        if output.quantiles is not None
        else None
    )

    if point.ndim != 1 or point.shape[0] != body.horizon:
        raise HTTPException(status_code=500, detail="TimesFM returned an unexpected forecast shape.")

    forecast_values = point.tolist()
    quantile_values = quantiles.tolist() if quantiles is not None else None

    latest = float(values[-1])
    forecast_end = float(point[-1])

    interval_low_end = None
    interval_high_end = None
    interval_width_end = None

    if quantiles is not None and quantiles.ndim == 2 and quantiles.shape[1] >= 9:
        interval_low_end = float(quantiles[-1, 0])
        interval_high_end = float(quantiles[-1, 8])
        interval_width_end = interval_high_end - interval_low_end

    return {
        "forecast": forecast_values,
        "quantiles": quantile_values,
        "metadata": {
            "engine": "timesfm-3.0",
            "model": MODEL_ID,
            "device": DEVICE,
            "quantiles": QUANTILES,
            "license": "timesfm-non-commercial-license-v1.0",
            "modelBacked": True,
        },
        "metrics": {
            "latest": latest,
            "forecastEnd": forecast_end,
            "absoluteChange": forecast_end - latest,
            "percentChange": percent_change(latest, forecast_end),
            "intervalLowEnd": interval_low_end,
            "intervalHighEnd": interval_high_end,
            "intervalWidthEnd": interval_width_end,
        },
    }
