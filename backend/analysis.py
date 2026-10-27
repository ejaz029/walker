
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
ACTUALS_FILE = DATA_DIR / "fuelhh_jan2026.json"
FORECASTS_FILE = DATA_DIR / "windfor_jan2026.json"

# Initial assumption; make this configurable for later validation.
DECISION_CUTOFF_UTC = "12:00"


def load_data():
    actuals = pd.read_json(ACTUALS_FILE)
    forecasts = pd.read_json(FORECASTS_FILE)

    for df in (actuals, forecasts):
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")

    actuals = actuals[
        (actuals["startTime"] >= "2026-01-01T00:00:00Z")
        & (actuals["startTime"] < "2026-02-01T00:00:00Z")
    ].copy()

    forecasts = forecasts[
        (forecasts["startTime"] >= "2026-01-01T00:00:00Z")
        & (forecasts["startTime"] < "2026-02-01T00:00:00Z")
    ].copy()

    return actuals, forecasts



def select_forecasts(forecasts):
    forecasts = forecasts.copy()

    # Provisional assumption: forecasts must be available by 12:00 UTC
    # on the day BEFORE delivery.
    delivery_date = forecasts["startTime"].dt.floor("D")
    cutoff = delivery_date - pd.Timedelta(days=1) + pd.Timedelta(hours=12)

    eligible = forecasts[forecasts["publishTime"] <= cutoff].copy()
    eligible = eligible.sort_values("publishTime")

    selected = eligible.drop_duplicates("startTime", keep="last")

    return selected[["startTime", "publishTime", "generation"]].rename(
        columns={
            "publishTime": "forecastPublishTime",
            "generation": "forecastGeneration",
        }
    )


def match_actuals_and_forecasts(actuals, selected_forecasts):
    # Actuals are half-hourly; forecasts are hourly.
    # Compare each hourly forecast against the mean of the two half-hourly actuals.
    hourly_actuals = (
        actuals.set_index("startTime")["generation"]
        .resample("h")
        .mean()
        .rename("actualGeneration")
        .reset_index()
    )

    matched = hourly_actuals.merge(
        selected_forecasts, on="startTime", how="inner"
    )
    matched = matched.dropna(
        subset=["actualGeneration", "forecastGeneration"]
    )

    matched["error"] = (
        matched["forecastGeneration"] - matched["actualGeneration"]
    )
    return matched


def calculate_metrics(matched):
    if matched.empty:
        return {
            "matched_hours": 0,
            "mae": None,
            "rmse": None,
            "mean_bias": None,
        }

    errors = matched["error"].to_numpy()

    return {
        "matched_hours": int(len(matched)),
        "mae": round(float(np.mean(np.abs(errors))), 2),
        "rmse": round(float(np.sqrt(np.mean(errors**2))), 2),
        "mean_bias": round(float(np.mean(errors)), 2),
    }


def main():
    actuals, forecasts = load_data()
    selected = select_forecasts(forecasts)
    matched = match_actuals_and_forecasts(actuals, selected)
    metrics = calculate_metrics(matched)

    output = DATA_DIR / "matched_forecasts_jan2026.csv"
    matched.to_csv(output, index=False)

    print("Selected forecast intervals:", len(selected))
    print("Matched intervals:", len(matched))
    print("Metrics (generation units):", metrics)
    print("Matched data saved to:", output)


if __name__ == "__main__":
    main()
