# Walker — UK Wind Forecast Accuracy Dashboard

**Live dashboard:** https://walker-mu.vercel.app/  
**API documentation:** https://windscope-api-1jk6.onrender.com/docs  
**GitHub repository:** https://github.com/ejaz029/walker

## Overview

Walker evaluates the accuracy of day-ahead wind generation forecasts for Great Britain using data from Elexon's Balancing Mechanism Reporting Service (BMRS).

It compares forecast generation with actual generation and provides metrics and visualizations to help users understand forecast errors before electricity purchasing decisions.

The analysis covers January 2026.

## Features

- **Forecast accuracy:** MAE, RMSE, mean bias, and normalized MAE.
- **Error distribution:** P50, P90, and P95 absolute errors.
- **Decision-time cutoff:** Select the latest forecast publication time allowed on the previous day.
- **Accuracy analysis:** Explore forecast errors by hour and forecast horizon.
- **Interval explorer:** Inspect matched forecasts and actual generation.
- **CSV export:** Export matched data for further analysis.

## Data source and methodology

Data is sourced from Elexon's Balancing Mechanism Reporting Service (BMRS).

- **Actual generation:** FUELHH dataset
- **Wind forecasts:** WINDFOR dataset
- **Analysis period:** 1–31 January 2026
- **Geography:** Great Britain
- **Units:** MW

Actual generation is recorded at half-hourly intervals and aggregated to hourly averages to match the forecast intervals.

For each delivery interval, Walker selects the latest forecast published before the configured cutoff on the previous day. It then compares that forecast with actual generation.

The default cutoff is **09:50 UTC on the previous day**, based on the N2EX day-ahead auction deadline. This cutoff applies to that auction and may not apply to other electricity purchasing decisions.

## Example results

At a cutoff of 09:50 UTC on the previous day:

| Metric | Result |
|---|---:|
| Matched hourly intervals | 744 |
| Mean absolute error (MAE) | 2,122.81 MW |
| Root mean square error (RMSE) | 2,616.69 MW |
| Mean forecast bias | +1,840.30 MW |
| P50 absolute error | 1,714.00 MW |
| P90 absolute error | 4,312.40 MW |
| P95 absolute error | 5,418.53 MW |
| Normalized MAE | 18.33% |

Positive mean bias indicates that forecasts were higher than actual generation on average.

P90 absolute error means that 90% of matched intervals had absolute errors at or below the reported value.

Normalized MAE is calculated as:

`MAE / mean actual generation × 100`

These results apply to the selected January 2026 dataset and cutoff. They should not be interpreted as a guarantee of future forecast performance.

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

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r backend/requirements.txt
```

Start the API:

```bash
uvicorn backend.main:app --reload
```

The backend will be available at:

- API: http://127.0.0.1:8000
- API documentation: http://127.0.0.1:8000/docs

### 3. Set up the frontend

Open a second terminal and run:

```bash
cd frontend
npm install
```

Create a file named `.env.local` inside the `frontend/` directory:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local frontend URL, usually http://localhost:5173.

### 4. Run tests

From the repository root, with the Python environment activated:

```bash
python -m pytest -q
```

## Docker

### Prerequisite

Install and start Docker Desktop.

### Run the backend

From the repository root:

```bash
docker compose up --build
```

The backend will be available at:

- API: http://localhost:8000
- Health check: http://localhost:8000/health
- API documentation: http://localhost:8000/docs
- Summary metrics: http://localhost:8000/api/summary?cutoff_hour=9&cutoff_minute=50

To stop the containers, press `Ctrl+C`. To remove the container and network, run:

```bash
docker compose down
```

Docker packages the FastAPI backend and the January 2026 Elexon datasets. Run the React frontend separately using the local frontend instructions above.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Check backend health |
| `GET /api/summary` | Return forecast accuracy metrics |
| `GET /api/forecasts` | Return matched hourly forecast and actual records |
| `GET /api/breakdowns` | Return error breakdowns |

The summary and analysis endpoints accept `cutoff_hour` and `cutoff_minute` query parameters.

## AI-tool disclosure

AI assistance was used during development for coding support, debugging, and documentation. The project author is responsible for reviewing and validating the implementation and results.

## Future improvements

- Validate the cutoff for other electricity purchasing decisions and market arrangements.
- Add automated data refresh and broader historical evaluation.
- Add further validation and edge-case tests.
- Improve deployment monitoring and error reporting.
