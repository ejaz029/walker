
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# from analysis import calculate_metrics, load_data, match_actuals_and_forecasts, select_forecasts
from backend.analysis import (
    calculate_metrics,
    load_data,
    match_actuals_and_forecasts,
    select_forecasts,
)

app = FastAPI(title="UK Wind Forecast Accuracy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to the deployed frontend URL before production.
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


def get_analysis():
    actuals, forecasts = load_data()
    selected = select_forecasts(forecasts)
    matched = match_actuals_and_forecasts(actuals, selected)
    return matched, calculate_metrics(matched)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary")
def summary():
    matched, metrics = get_analysis()
    return {
        **metrics,
        "forecast_cutoff_utc": "12:00 on the previous day",
        "period": "January 2026",
        "units": "MW",
    }


@app.get("/api/forecasts")
def forecasts(limit: int = 100):
    if limit < 1 or limit > 1488:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 1488")

    matched, _ = get_analysis()
    result = matched.sort_values("startTime").head(limit).copy()
    result["startTime"] = result["startTime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    result["forecastPublishTime"] = result["forecastPublishTime"].dt.strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    return result.to_dict(orient="records")
