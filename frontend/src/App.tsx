import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, Bar, BarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3,
  CalendarDays, ChartNoAxesCombined, CircleHelp, Clock3,
  Download, Gauge, LayoutDashboard, RefreshCw, Wind, SlidersHorizontal,
} from "lucide-react";
import "./App.css";
import "./fx.css";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

type Summary = {
  matched_hours: number;
  mae: number | null;
  rmse: number | null;
  mean_bias: number | null;
  p50_absolute_error: number | null;
  p90_absolute_error: number | null;
  p95_absolute_error: number | null;
  normalized_mae_pct: number | null;
  worst_underforecast_mw: number | null;
  worst_overforecast_mw: number | null;
  forecast_cutoff_utc: string;
  cutoff_is_provisional: boolean;
  period: string;
  units: string;
};
type Forecast = {
  startTime: string;
  actualGeneration: number;
  forecastGeneration: number;
  forecastPublishTime: string;
  error: number;
  absolute_error?: number;
  hour_of_day?: number;
  horizon_hours?: number;
};
type Breakdown = {
  by_hour: { hour: number; matched_hours: number; mae: number; mean_bias: number }[];
  by_horizon: { horizon: string; matched_hours: number; mae: number; mean_bias: number }[];
};
type View = "overview" | "accuracy" | "intervals";

function formatNumber(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
}
function formatTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [breakdowns, setBreakdowns] = useState<Breakdown | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [showActual, setShowActual] = useState(true);
  const [showForecast, setShowForecast] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cutoffHour, setCutoffHour] = useState(12);
  const [cutoffMinute, setCutoffMinute] = useState(0);
  const [appliedCutoff, setAppliedCutoff] = useState({ hour: 12, minute: 0 });


  async function loadData(hour = appliedCutoff.hour, minute = appliedCutoff.minute) {
    setLoading(true);
    setError("");
    try {
      const params = `cutoff_hour=${hour}&cutoff_minute=${minute}`;
      const [summaryResponse, forecastResponse, breakdownResponse] = await Promise.all([
        fetch(`${API}/api/summary?${params}`),
        fetch(`${API}/api/forecasts?limit=744&${params}`),
        fetch(`${API}/api/breakdowns?${params}`),
      ]);
      if (!summaryResponse.ok || !forecastResponse.ok || !breakdownResponse.ok) {
        throw new Error("Backend returned an error");
      }
      const [summaryData, forecastData, breakdownData] = await Promise.all([
        summaryResponse.json(), forecastResponse.json(), breakdownResponse.json(),
      ]);
      setSummary(summaryData);
      setForecasts(forecastData);
      setBreakdowns(breakdownData);
      setAppliedCutoff({ hour, minute });
    } catch {
      setError(`Can't reach the analysis API at ${API}. Check that FastAPI is running and VITE_API_URL is correct.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(12, 0); }, []);

  const chartData = useMemo(() => forecasts.map((item) => ({
    ...item,
    time: new Date(item.startTime).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", timeZone: "UTC",
    }),
  })), [forecasts]);

  const filteredForecasts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return forecasts.filter((item) =>
      !term || item.startTime.toLowerCase().includes(term)
        || item.forecastPublishTime.toLowerCase().includes(term)
    );
  }, [forecasts, search]);

  const worstMiss = useMemo(() => {
    if (!forecasts.length) return null;
    return forecasts.reduce((worst, item) =>
      Math.abs(item.error) > Math.abs(worst.error) ? item : worst, forecasts[0]);
  }, [forecasts]);

  function exportCsv() {
    const header = "startTime,forecastGeneration,actualGeneration,error,forecastPublishTime";
    const rows = filteredForecasts.map((item) =>
      [item.startTime, item.forecastGeneration, item.actualGeneration,
        item.error, item.forecastPublishTime].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wind-forecast-analysis.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "accuracy", label: "Accuracy analysis", icon: ChartNoAxesCombined },
    { id: "intervals", label: "Interval explorer", icon: BarChart3 },
  ];

  return (
    <div className="app-shell">
      <div className="aurora" aria-hidden="true"><i /></div>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Wind size={21} /></span>
          <span>WindScope<small>ENERGY INTELLIGENCE</small></span>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav>{navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-link ${view === id ? "active" : ""}`} onClick={() => setView(id)}>
            <Icon size={17} /> {label}
          </button>
        ))}</nav>
        <div className="sidebar-bottom">
          <div className="source-indicator"><span /> Elexon data source</div>
          <p>National wind generation<br />Great Britain · January 2026</p>
          <div className="side-version">WIND ANALYTICS <span>v1.1</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Energy analytics <span>/</span> {navItems.find((n) => n.id === view)?.label}</div>
          <div className="top-actions">
            <span className="period-chip"><CalendarDays size={14} /> JAN 01 — JAN 31, 2026</span>
            <button className="icon-button" onClick={() => void loadData()} title="Refresh data" disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        <section className="page-intro">
          <div>
            <div className="eyebrow"><span /> PROCUREMENT DECISION SUPPORT</div>
            <h1>{view === "overview" ? "Wind forecast overview" : view === "accuracy" ? "Forecast accuracy" : "Interval explorer"}</h1>
            <p>Assess forecast uncertainty before day-ahead electricity purchasing decisions.</p>
          </div>
          <button className="button-secondary" onClick={exportCsv} disabled={!forecasts.length}>
            <Download size={15} /> Export CSV
          </button>
        </section>

        <section className="cutoff-panel">
          <div className="cutoff-copy">
            <div className="cutoff-title"><SlidersHorizontal size={16} /> Decision-time cutoff</div>
            <p>Choose the latest publication time allowed on the day before delivery.</p>
          </div>
          <div className="cutoff-controls">
            <label>UTC hour
              <select value={cutoffHour} onChange={(e) => setCutoffHour(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
              </select>
            </label>
            <label>Minute
              <select value={cutoffMinute} onChange={(e) => setCutoffMinute(Number(e.target.value))}>
                {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
              </select>
            </label>
            <button className="button-secondary" onClick={() => void loadData(cutoffHour, cutoffMinute)} disabled={loading}>
              Apply cutoff
            </button>
          </div>
          <div className="cutoff-warning"><CircleHelp size={14} /> Provisional assumption — verify the purchasing decision deadline before operational use.</div>
        </section>

        {error && <div className="error-banner">{error}</div>}
        {!summary && !error && <div className="loading-state">Loading January wind data…</div>}

        {summary && (
          <>
            <section className="data-status">
              <div className="status-dot" />
              <span><strong>Analysis loaded</strong> · {summary.matched_hours} matched hourly intervals</span>
              <span className="status-note"><Clock3 size={13} /> Cutoff: {summary.forecast_cutoff_utc}</span>
            </section>

            {view !== "intervals" && (
              <>
                <section className="kpi-grid kpi-grid-expanded">
                  <Metric icon={Activity} label="Mean absolute error" value={summary.mae} unit="MW" note="Average absolute forecast deviation" />
                  <Metric icon={Gauge} label="Root mean square error" value={summary.rmse} unit="MW" note="Penalizes larger errors more heavily" />
                  <Metric icon={summary.mean_bias != null && summary.mean_bias >= 0 ? ArrowUpRight : ArrowDownRight}
                    label="Mean forecast bias" value={summary.mean_bias} unit="MW" note="Positive means overforecasting" bias />
                  <Metric icon={BarChart3} label="P50 absolute error" value={summary.p50_absolute_error} unit="MW" note="Median absolute error" />
                  <Metric icon={Activity} label="P90 absolute error" value={summary.p90_absolute_error} unit="MW" note="90% of absolute errors at or below this" />
                  <Metric icon={Activity} label="P95 absolute error" value={summary.p95_absolute_error} unit="MW" note="95% of absolute errors at or below this" />
                  <Metric icon={ChartNoAxesCombined} label="Normalized MAE" value={summary.normalized_mae_pct} unit="%" note="MAE as a share of mean actual generation" />
                  <Metric icon={BarChart3} label="Matched hours" value={summary.matched_hours} unit="of 744" note="Hourly intervals included in analysis" />
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div><div className="eyebrow">GENERATION PROFILE</div><h2>Forecast vs actual</h2>
                      <p>Hourly national wind generation · values in MW</p></div>
                    <div className="legend-toggles">
                      <button className={showActual ? "selected actual" : ""} onClick={() => setShowActual(!showActual)}><span /> Actual</button>
                      <button className={showForecast ? "selected forecast" : ""} onClick={() => setShowForecast(!showForecast)}><span /> Forecast</button>
                    </div>
                  </div>
                  <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#36d5a4" stopOpacity={0.22} /><stop offset="95%" stopColor="#36d5a4" stopOpacity={0} /></linearGradient>
                        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#739cff" stopOpacity={0.15} /><stop offset="95%" stopColor="#739cff" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid stroke="#263646" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: "#8194a9", fontSize: 11 }} minTickGap={42} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8194a9", fontSize: 11 }} axisLine={false} tickLine={false} width={54} />
                      <Tooltip contentStyle={{ background: "#111c28", border: "1px solid #304456", borderRadius: 10, fontSize: 12 }} />
                      {showActual && <Area type="monotone" dataKey="actualGeneration" name="Actual" stroke="#36d5a4" fill="url(#actualFill)" strokeWidth={2} dot={false} />}
                      {showForecast && <Area type="monotone" dataKey="forecastGeneration" name="Forecast" stroke="#739cff" fill="url(#forecastFill)" strokeWidth={2} dot={false} />}
                    </AreaChart>
                  </ResponsiveContainer></div>
                </section>
              </>
            )}

            {view === "accuracy" && (
              <>
                <section className="panel">
                  <div className="panel-heading"><div><div className="eyebrow">ERROR DISTRIBUTION OVER TIME</div><h2>Forecast error by delivery hour</h2><p>Forecast minus actual generation · MW</p></div></div>
                  <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#263646" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="time" tick={{ fill: "#8194a9", fontSize: 11 }} minTickGap={42} />
                      <YAxis tick={{ fill: "#8194a9", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#111c28", border: "1px solid #304456", borderRadius: 10 }} />
                      <Line type="monotone" dataKey="error" name="Forecast error" stroke="#f5b45f" strokeWidth={1.7} dot={false} />
                    </LineChart>
                  </ResponsiveContainer></div>
                </section>
                <section className="analysis-grid">
                  <div className="panel">
                    <div className="panel-heading"><div><div className="eyebrow">TIME-OF-DAY PATTERN</div><h2>MAE by hour of day</h2><p>UTC hour · MW</p></div></div>
                    <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdowns?.by_hour ?? []}>
                        <CartesianGrid stroke="#263646" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fill: "#8194a9", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#8194a9", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#111c28", border: "1px solid #304456", borderRadius: 10 }} />
                        <Bar dataKey="mae" name="MAE (MW)" fill="#739cff" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer></div>
                  </div>
                  <div className="panel">
                    <div className="panel-heading"><div><div className="eyebrow">FORECAST LEAD TIME</div><h2>MAE by forecast horizon</h2><p>Time from publication to delivery · MW</p></div></div>
                    <div className="chart-area"><ResponsiveContainer width="100%" height="100%">
                      <BarChart data={breakdowns?.by_horizon ?? []}>
                        <CartesianGrid stroke="#263646" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="horizon" tick={{ fill: "#8194a9", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#8194a9", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#111c28", border: "1px solid #304456", borderRadius: 10 }} />
                        <Bar dataKey="mae" name="MAE (MW)" fill="#36d5a4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer></div>
                  </div>
                </section>
                {worstMiss && <section className="panel worst-miss">
                  <div><div className="eyebrow">LARGEST ABSOLUTE MISS IN LOADED PERIOD</div><h2>{formatNumber(Math.abs(worstMiss.error))} MW {worstMiss.error > 0 ? "overforecast" : "underforecast"}</h2>
                    <p>{formatTime(worstMiss.startTime)} · forecast {formatNumber(worstMiss.forecastGeneration)} MW vs actual {formatNumber(worstMiss.actualGeneration)} MW</p></div>
                </section>}
              </>
            )}

            {view === "intervals" && (
              <section className="panel">
                <div className="panel-heading">
                  <div><div className="eyebrow">HOURLY DATA</div><h2>Forecast records</h2><p>Inspect matched forecasts and actual generation.</p></div>
                  <span className="record-count">{filteredForecasts.length} records</span>
                </div>
                <input className="search-input" placeholder="Search timestamps (e.g. 2026-01-15)" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="table-scroll"><table><thead><tr><th>Delivery time (UTC)</th><th>Forecast MW</th><th>Actual MW</th><th>Error MW</th><th>Published UTC</th></tr></thead>
                  <tbody>{filteredForecasts.slice(0, 100).map((item) => (
                    <tr key={item.startTime}><td>{item.startTime.replace("T", " ").slice(0, 16)}</td><td>{formatNumber(item.forecastGeneration)}</td><td>{formatNumber(item.actualGeneration)}</td><td className={item.error > 0 ? "error-positive" : "error-negative"}>{formatNumber(item.error)}</td><td>{item.forecastPublishTime.replace("T", " ").slice(0, 16)}</td></tr>
                  ))}</tbody></table>
                  {!filteredForecasts.length && <p className="empty-state">No intervals match that search. Try a date such as 2026-01-15.</p>}
                </div>
                <p className="table-footnote">Showing up to 100 matching rows. Export CSV to download all loaded intervals.</p>
              </section>
            )}

            <section className="method-note">
              <CircleHelp size={17} />
              <div><strong>Interpretation & methodology</strong><p>Forecast error is forecast minus actual. Positive bias indicates overforecasting. P90 absolute error is the 90th percentile of absolute errors; it is not a probability that generation will fall below forecast by that amount. Actuals are half-hourly and aggregated to hourly means to match hourly forecasts. Forecasts have multiple publication versions; this analysis selects the latest version published by the chosen previous-day UTC cutoff. The cutoff remains provisional and must be validated against the actual purchasing decision deadline.</p></div>
            </section>
          </>
        )}
        <footer><span>WINDSCOPE · UK WIND FORECAST ANALYSIS</span><span>Data source: Elexon BMRS</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, note, bias = false }: {
  icon: typeof Activity; label: string; value: number | null; unit: string; note: string; bias?: boolean;
}) {
  return <article className="kpi-card" onMouseMove={(event) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    card.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }}>
    <div className="kpi-top"><span>{label}</span><span className={`kpi-icon ${bias ? "bias-icon" : ""}`}><Icon size={17} /></span></div>
    <div className="kpi-value">{formatNumber(value)}<small>{unit}</small></div>
    <div className="kpi-note">{note}</div>
  </article>;
}

export default App;
