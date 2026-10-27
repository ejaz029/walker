
import os
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.analysis import (
    calculate_metrics,
    error_breakdowns,
    load_data,
    match_actuals_and_forecasts,
    select_forecasts,
)

app = FastAPI(title="UK Wind Forecast Accuracy API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=16)
def get_analysis(cutoff_hour=12, cutoff_minute=0):
    actuals, forecasts = load_data()
    selected = select_forecasts(
        forecasts,
        cutoff_hour=cutoff_hour,
        cutoff_minute=cutoff_minute,
    )
    matched = match_actuals_and_forecasts(actuals, selected)
    return matched, calculate_metrics(matched), error_breakdowns(matched)


def check_cutoff(cutoff_hour, cutoff_minute):
    if not 0 <= cutoff_hour <= 23:
        raise HTTPException(status_code=400, detail="cutoff_hour must be 0-23")
    if not 0 <= cutoff_minute <= 59:
        raise HTTPException(status_code=400, detail="cutoff_minute must be 0-59")


def json_safe_records(frame):
    safe = frame.copy()
    for column in ("startTime", "forecastPublishTime"):
        if column in safe.columns:
            safe[column] = pd.to_datetime(safe[column], utc=True).dt.strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
    safe = safe.astype(object).where(pd.notna(safe), None)
    return safe.to_dict(orient="records")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/summary")
def summary(cutoff_hour: int = 12, cutoff_minute: int = 0):
    check_cutoff(cutoff_hour, cutoff_minute)
    _, metrics, _ = get_analysis(cutoff_hour, cutoff_minute)
    return {
        **metrics,
        "forecast_cutoff_utc": (
            f"{cutoff_hour:02d}:{cutoff_minute:02d} UTC on the previous day"
        ),
        "cutoff_is_provisional": True,
        "period": "January 2026",
        "units": "MW",
    }


@app.get("/api/forecasts")
def forecasts(
    limit: int = 744,
    cutoff_hour: int = 12,
    cutoff_minute: int = 0,
):
    check_cutoff(cutoff_hour, cutoff_minute)
    if not 1 <= limit <= 1488:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 1488",
        )

    matched, _, _ = get_analysis(cutoff_hour, cutoff_minute)
    result = matched.sort_values("startTime").head(limit)
    return json_safe_records(result)


@app.get("/api/breakdowns")
def breakdowns(cutoff_hour: int = 12, cutoff_minute: int = 0):
    check_cutoff(cutoff_hour, cutoff_minute)
    _, _, result = get_analysis(cutoff_hour, cutoff_minute)
    return result
