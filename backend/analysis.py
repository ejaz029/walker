
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
ACTUALS_FILE = DATA_DIR / "fuelhh_jan2026.json"
FORECASTS_FILE = DATA_DIR / "windfor_jan2026.json"


def load_data():
    actuals = pd.read_json(ACTUALS_FILE)
    forecasts = pd.read_json(FORECASTS_FILE)

    for df in (actuals, forecasts):
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
        df["generation"] = pd.to_numeric(df["generation"], errors="coerce")

    start = pd.Timestamp("2026-01-01T00:00:00Z")
    end = pd.Timestamp("2026-02-01T00:00:00Z")

    actuals = actuals[
        (actuals["startTime"] >= start)
        & (actuals["startTime"] < end)
    ].copy()

    forecasts = forecasts[
        (forecasts["startTime"] >= start)
        & (forecasts["startTime"] < end)
    ].copy()

    actuals = actuals.dropna(subset=["generation"])
    forecasts = forecasts.dropna(subset=["generation", "publishTime"])

    return actuals, forecasts


def select_forecasts(forecasts, cutoff_hour=12, cutoff_minute=0):
    """Select the latest forecast published by the previous-day UTC cutoff."""
    if not 0 <= cutoff_hour <= 23:
        raise ValueError("cutoff_hour must be between 0 and 23")
    if not 0 <= cutoff_minute <= 59:
        raise ValueError("cutoff_minute must be between 0 and 59")

    forecasts = forecasts.copy()
    delivery_date = forecasts["startTime"].dt.floor("D")

    cutoff = (
        delivery_date
        - pd.Timedelta(days=1)
        + pd.Timedelta(hours=cutoff_hour, minutes=cutoff_minute)
    )

    eligible = forecasts[
        forecasts["publishTime"] <= cutoff
    ].copy()

    eligible = eligible.sort_values("publishTime")
    selected = eligible.drop_duplicates("startTime", keep="last")

    return selected[
        ["startTime", "publishTime", "generation"]
    ].rename(
        columns={
            "publishTime": "forecastPublishTime",
            "generation": "forecastGeneration",
        }
    )


def match_actuals_and_forecasts(actuals, selected_forecasts):
    """Compare hourly forecasts with hourly means of half-hourly actuals."""
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
    ).copy()

    matched["error"] = (
        matched["forecastGeneration"] - matched["actualGeneration"]
    )

    matched["absolute_error"] = matched["error"].abs()
    matched["hour_of_day"] = matched["startTime"].dt.hour
    matched["horizon_hours"] = (
        matched["startTime"] - matched["forecastPublishTime"]
    ).dt.total_seconds() / 3600

    return matched


def calculate_metrics(matched):
    if matched.empty:
        return {
            "matched_hours": 0,
            "mae": None,
            "rmse": None,
            "mean_bias": None,
            "p50_absolute_error": None,
            "p90_absolute_error": None,
            "p95_absolute_error": None,
            "normalized_mae_pct": None,
            "worst_underforecast_mw": None,
            "worst_overforecast_mw": None,
        }

    errors = matched["error"].to_numpy(dtype=float)
    absolute_errors = np.abs(errors)
    mean_actual = (
    float(matched["actualGeneration"].mean())
    if "actualGeneration" in matched.columns
    else None
)

    underforecast = matched.loc[matched["error"] < 0]
    overforecast = matched.loc[matched["error"] > 0]

    return {
        "matched_hours": int(len(matched)),
        "mae": round(float(np.mean(absolute_errors)), 2),
        "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 2),
        "mean_bias": round(float(np.mean(errors)), 2),
        "p50_absolute_error": round(float(np.percentile(absolute_errors, 50)), 2),
        "p90_absolute_error": round(float(np.percentile(absolute_errors, 90)), 2),
        "p95_absolute_error": round(float(np.percentile(absolute_errors, 95)), 2),
        "normalized_mae_pct": (
            round(float(np.mean(absolute_errors) / mean_actual * 100), 2)
            if mean_actual is not None and mean_actual > 0 else None
        ),
        "worst_underforecast_mw": (
            round(float(-underforecast["error"].min()), 2)
            if not underforecast.empty else 0.0
        ),
        "worst_overforecast_mw": (
            round(float(overforecast["error"].max()), 2)
            if not overforecast.empty else 0.0
        ),
    }


def error_breakdowns(matched):
    """Return JSON-friendly summaries for charts."""
    if matched.empty:
        return {"by_hour": [], "by_horizon": []}

    by_hour = (
        matched.groupby("hour_of_day")
        .agg(
            matched_hours=("error", "size"),
            mae=("absolute_error", "mean"),
            mean_bias=("error", "mean"),
        )
        .reset_index()
        .round(2)
        .rename(columns={"hour_of_day": "hour"})
        .to_dict(orient="records")
    )

    bins = [0, 6, 12, 18, 24, 36, 48, float("inf")]
    labels = ["0–6h", "6–12h", "12–18h", "18–24h",
              "24–36h", "36–48h", "48h+"]

    horizon_data = matched.copy()
    horizon_data["horizon_bucket"] = pd.cut(
        horizon_data["horizon_hours"],
        bins=bins,
        labels=labels,
        right=False,
    )

    by_horizon = (
        horizon_data.dropna(subset=["horizon_bucket"])
        .groupby("horizon_bucket", observed=True)
        .agg(
            matched_hours=("error", "size"),
            mae=("absolute_error", "mean"),
            mean_bias=("error", "mean"),
        )
        .reset_index()
        .round(2)
        .rename(columns={"horizon_bucket": "horizon"})
        .to_dict(orient="records")
    )

    return {"by_hour": by_hour, "by_horizon": by_horizon}


def main():
    actuals, forecasts = load_data()
    selected = select_forecasts(forecasts)
    matched = match_actuals_and_forecasts(actuals, selected)
    metrics = calculate_metrics(matched)

    output = DATA_DIR / "matched_forecasts_jan2026.csv"
    matched.to_csv(output, index=False)

    print("Selected forecast intervals:", len(selected))
    print("Matched hourly intervals:", len(matched))
    print("Metrics:", metrics)
    print("Error breakdowns:", error_breakdowns(matched))
    print("Matched data saved to:", output)


if __name__ == "__main__":
    main()
