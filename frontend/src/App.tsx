
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:8000";

type Summary = {
  matched_hours: number;
  mae: number | null;
  rmse: number | null;
  mean_bias: number | null;
  forecast_cutoff_utc: string;
  period: string;
  units: string;
};

type Forecast = {
  startTime: string;
  actualGeneration: number;
  forecastGeneration: number;
  forecastPublishTime: string;
  error: number;
};

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/summary`).then((r) => {
        if (!r.ok) throw new Error("Could not load summary");
        return r.json();
      }),
      fetch(`${API}/api/forecasts?limit=744`).then((r) => {
        if (!r.ok) throw new Error("Could not load forecasts");
        return r.json();
      }),
    ])
      .then(([summaryData, forecastData]) => {
        setSummary(summaryData);
        setForecasts(forecastData);
      })
      .catch(() => setError("Unable to connect to the backend. Start FastAPI on port 8000."));
  }, []);

  const chartData = forecasts.map((item) => ({
    time: new Date(item.startTime).toLocaleString("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }),
    actual: item.actualGeneration,
    forecast: item.forecastGeneration,
  }));

  return (
    <main className="dashboard">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">W</span> WindScope</div>
        <span className="period">UK NATIONAL WIND · JAN 2026</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ENERGY PROCUREMENT INTELLIGENCE</p>
        <h1>Wind forecast performance</h1>
        <p className="subtitle">
          Understand forecast errors before making day-ahead purchasing decisions.
        </p>
      </section>

      {error && <div className="error">{error}</div>}
      {!summary && !error && <p>Loading January data…</p>}

      {summary && (
        <>
          <section className="metrics">
            <Metric label="Mean absolute error" value={summary.mae} unit="MW" />
            <Metric label="Root mean square error" value={summary.rmse} unit="MW" />
            <Metric label="Mean forecast bias" value={summary.mean_bias} unit="MW" />
            <Metric label="Matched hours" value={summary.matched_hours} unit="hours" />
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">HOURLY GENERATION</p>
                <h2>Forecast vs actual</h2>
              </div>
              <span className="unit">MW</span>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="#293746" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#91a2b5", fontSize: 11 }}
                    minTickGap={45}
                  />
                  <YAxis tick={{ fill: "#91a2b5", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#111c29",
                      border: "1px solid #344558",
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Actual generation"
                    stroke="#36c9a0"
                    fill="#36c9a0"
                    fillOpacity={0.12}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    name="Forecast generation"
                    stroke="#6b9cff"
                    fill="#6b9cff"
                    fillOpacity={0.08}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">DATA EXPLORER</p>
                <h2>Hourly forecast records</h2>
              </div>
              <span className="unit">{forecasts.length} records</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Delivery time (UTC)</th>
                    <th>Forecast (MW)</th>
                    <th>Actual (MW)</th>
                    <th>Error (MW)</th>
                    <th>Published (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.slice(0, 24).map((item) => (
                    <tr key={item.startTime}>
                      <td>{item.startTime.replace("T", " ").slice(0, 16)}</td>
                      <td>{item.forecastGeneration.toLocaleString()}</td>
                      <td>{item.actualGeneration.toLocaleString()}</td>
                      <td className={item.error > 0 ? "positive" : "negative"}>
                        {item.error.toLocaleString()}
                      </td>
                      <td>{item.forecastPublishTime.replace("T", " ").slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="disclaimer">
            Analytical assumption: forecast cutoff at 12:00 UTC on the previous
            delivery day. Validate this cutoff against the applicable purchasing
            decision process before using these results operationally. Errors are
            forecast minus actual; positive bias indicates overforecasting.
          </p>
        </>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <article className="metric">
      <p>{label}</p>
      <strong>{value == null ? "—" : value.toLocaleString("en-GB", {
        maximumFractionDigits: 2,
      })}</strong>
      <span>{unit}</span>
    </article>
  );
}

export default App;
