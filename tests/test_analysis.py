
import pandas as pd

from backend.analysis import calculate_metrics, match_actuals_and_forecasts


def test_calculate_metrics():
    matched = pd.DataFrame({"error": [10.0, -10.0, 0.0]})

    metrics = calculate_metrics(matched)

    assert metrics["matched_hours"] == 3
    assert metrics["mae"] == 6.67
    assert metrics["rmse"] == 8.16
    assert metrics["mean_bias"] == 0.0


def test_match_hourly_forecast_to_half_hourly_actuals():
    actuals = pd.DataFrame({
        "startTime": pd.to_datetime([
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:30:00Z",
        ], utc=True),
        "generation": [100.0, 120.0],
    })

    forecasts = pd.DataFrame({
        "startTime": pd.to_datetime(["2026-01-01T00:00:00Z"], utc=True),
        "forecastPublishTime": pd.to_datetime(
            ["2025-12-31T12:00:00Z"], utc=True
        ),
        "forecastGeneration": [110.0],
    })

    matched = match_actuals_and_forecasts(actuals, forecasts)

    assert len(matched) == 1
    assert matched.iloc[0]["actualGeneration"] == 110.0
    assert matched.iloc[0]["forecastGeneration"] == 110.0
    assert matched.iloc[0]["error"] == 0.0
