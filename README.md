# WALKER — UK Wind Forecast Accuracy Dashboard

**Live dashboard:** https://walker-mu.vercel.app/  
**API documentation:** https://windscope-api-1jk6.onrender.com/docs

## Overview

Walker evaluates the accuracy of day ahead wind generation forecasts for Great Britain using Elexon data. It provides quantitative error metrics and interval-level comparisons to help users understand forecast uncertainty before electricity purchasing decisions.

The analysis covers January 2026 and compares hourly forecasts with hourly actual generation.

## Features

- **Forecast accuracy:** MAE, RMSE, mean bias, and normalized MAE.
- **Error distribution:** P50, P90, and P95 absolute errors.
- **Decision-time cutoff:** Select the latest forecast publication time allowed on the previous day.
- **Accuracy analysis:** Explore forecast errors by hour and forecast horizon.
- **Interval explorer:** Inspect matched forecasts and actual generation.
- **CSV export:** Export analysis data for further investigation.

## Data source

Data is sourced from Elexon's Balancing Mechanism Reporting Service (BMRS).

- Actual generation — [FUELHH dataset](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- Wind forecasts — [WINDFOR dataset](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)

**Analysis period:** 1–31 January 2026  
**Geography:** Great Britain  
**Units:** MW

Actual generation is recorded at half-hourly intervals and aggregated to hourly averages to match the forecast intervals. Forecasts are selected using their publication timestamps and the configured cutoff.

> **Important limitation:** The default cutoff of 12:00 UTC on the previous day is a provisional assumption, not a verified electricity-market purchasing deadline. Validate the appropriate market timing before using these results operationally.

## Example results

At a cutoff of 12:00 UTC on the previous day:

| Metric | Result |
|---|---:|
| Matched hourly intervals | 744 |
| Mean absolute error (MAE) | 2,017.92 MW |
| Root mean square error (RMSE) | 2,477.04 MW |
| Mean forecast bias | +1,806.23 MW |
| P50 absolute error | 1,700.75 MW |
| P90 absolute error | 4,000.55 MW |
| P95 absolute error | 4,723.33 MW |
| Normalized MAE | 17.42% |

Positive mean bias indicates that forecasts were higher than actual generation on average. P90 absolute error means 90% of matched intervals had absolute errors at or below the reported value.

These are results for the selected January 2026 dataset and cutoff; they should not be interpreted as a guarantee of future forecast performance.

## Technology stack

**Frontend**
- React
- TypeScript
- Vite
- CSS

**Backend**
- Python
- FastAPI
- Pandas
- NumPy

**Deployment**
- Vercel — frontend
- Render — backend API

## Project structure

```text
wind-forecast-dashboard/
├── backend/
│   ├── analysis.py
│   ├── main.py
│   └── requirements.txt
├── data/
│   └── raw/
│       ├── fuelhh_jan2026.json
│       └── windfor_jan2026.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
├── tests/
├── .gitignore
└── README.md
```

## Run locally

### Requirements

- Python 3.11 or newer
- Node.js and npm

### 1. Clone the repository

```bash
git clone https://github.com/ejaz029/walker.git
cd walker
```

### 2. Set up the backend

From the repository root:

```bash
python -m venv .venv
```

Activate the environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies and start the API:

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Backend: http://127.0.0.1:8000  
API docs: http://127.0.0.1:8000/docs

### 3. Set up the frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a file named `.env.local` inside `frontend/`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

Vite will print the local frontend URL, usually http://localhost:5173.

### 4. Run tests

From the repository root, with the Python environment activated:

```bash
python -m pytest -q
```

## Docker

Docker support has not yet been documented as verified. The following commands require a `Dockerfile` and, if using Compose, a `docker-compose.yml` to be added to the repository before they will work.

Example commands once those files are provided:

```bash
docker build -t windscope .
docker run -p 8000:8000 windscope
```

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Check backend health |
| `GET /api/summary` | Return forecast accuracy metrics |
| `GET /api/forecasts` | Return matched hourly forecast and actual records |
| `GET /api/breakdowns` | Return error breakdowns |

The summary and analysis endpoints accept `cutoff_hour` and `cutoff_minute` query parameters.

## AI-tool disclosure

AI assistance was used during development for coding support, debugging, and documentation. All generated code and analysis should be reviewed and validated by the project author.

## Future improvements

- Verify the correct market decision-time cutoff against authoritative market rules.
- Add automated data refresh and broader historical evaluation.
- Add additional validation and edge-case tests.
- Improve deployment monitoring and error reporting.

## License 
   wait
