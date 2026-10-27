
import json
from pathlib import Path

import pandas as pd
import requests

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
OUTPUT_DIR = Path("data/raw")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch(endpoint: str, params: dict) -> pd.DataFrame:
    url = f"{BASE_URL}/{endpoint}/stream"
    print(f"Fetching {endpoint}...", flush=True)

    response = requests.get(url, params=params, timeout=180)
    response.raise_for_status()
    records = response.json()

    if not isinstance(records, list):
        raise ValueError(f"Unexpected response from {endpoint}")

    output = OUTPUT_DIR / f"{endpoint.lower()}_jan2026.json"
    output.write_text(json.dumps(records), encoding="utf-8")

    df = pd.DataFrame(records)
    print(f"  Records: {len(df):,} | Saved: {output}", flush=True)
    return df


def main():
    actuals = fetch(
        "FUELHH",
        {
            "settlementDateFrom": "2026-01-01",
            "settlementDateTo": "2026-01-31",
            "fuelType": "WIND",
        },
    )

    forecasts = fetch(
        "WINDFOR",
        {
            "publishDateTimeFrom": "2025-12-01T00:00:00Z",
            "publishDateTimeTo": "2026-02-01T00:00:00Z",
        },
    )

    for name, df in [("ACTUALS", actuals), ("FORECASTS", forecasts)]:
        print(f"\n--- {name} ---")
        print(f"Rows: {len(df):,}")
        print(f"Columns: {list(df.columns)}")

        for col in ("startTime", "publishTime"):
            if col in df.columns and not df.empty:
                times = pd.to_datetime(df[col], utc=True, errors="coerce")
                print(f"{col}: {times.min()} -> {times.max()}")

        if "generation" in df.columns:
            generation = pd.to_numeric(df["generation"], errors="coerce")
            print(f"Missing/invalid generation: {generation.isna().sum()}")

    if not actuals.empty and not forecasts.empty:
        actuals["startTime"] = pd.to_datetime(actuals["startTime"], utc=True)
        forecasts["startTime"] = pd.to_datetime(
            forecasts["startTime"], utc=True
        )
        forecasts["publishTime"] = pd.to_datetime(
            forecasts["publishTime"], utc=True
        )

        january_start = pd.Timestamp("2026-01-01", tz="UTC")
        february_start = pd.Timestamp("2026-02-01", tz="UTC")

        jan_actuals = actuals[
            actuals["startTime"].ge(january_start)
            & actuals["startTime"].lt(february_start)
        ]
        jan_forecasts = forecasts[
            forecasts["startTime"].ge(january_start)
            & forecasts["startTime"].lt(february_start)
        ]

        print("\n--- JANUARY COVERAGE ---")
        print(f"Actual rows targeting January: {len(jan_actuals):,}")
        print(
            "Unique actual intervals:",
            jan_actuals["startTime"].nunique(),
        )
        print(f"Forecast rows targeting January: {len(jan_forecasts):,}")
        print(
            "Unique forecast target intervals:",
            jan_forecasts["startTime"].nunique(),
        )
        print(
            "Unique forecast publication times:",
            jan_forecasts["publishTime"].nunique(),
        )

    print("\nExtraction complete.")


if __name__ == "__main__":
    main()
