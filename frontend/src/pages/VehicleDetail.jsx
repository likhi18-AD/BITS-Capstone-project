// frontend/src/pages/VehicleDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchVehicleTimeseries } from "../api/client";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [endIndex, setEndIndex] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(null);
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchVehicleTimeseries(vehicleId);
        if (cancelled) return;

        // Enrich records with index + monthKey + label
        const enriched = (data.records || []).map((r, idx) => {
          const monthTs =
            r.month_ts ||
            r.month_ts_str ||
            r.month_ts_iso ||
            r.month_ts_raw ||
            r.month_ts;
          const monthLabel = monthTs ? String(monthTs).slice(0, 7) : `M${idx + 1}`;
          return {
            ...r,
            idx,
            monthLabel,
            monthKey: monthLabel,
          };
        });

        setRecords(enriched);
        const lastIdx = enriched.length > 0 ? enriched.length - 1 : 0;
        setEndIndex(lastIdx);
        setSelectedMonthIndex(lastIdx);
        setMonthFilter(enriched[lastIdx]?.monthKey || "");
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load vehicle timeseries");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const filtered = useMemo(() => {
    if (!records.length) return [];
    if (endIndex == null) return records;
    return records.slice(0, endIndex + 1);
  }, [records, endIndex]);

  const selectedRecord =
    selectedMonthIndex != null && records[selectedMonthIndex]
      ? records[selectedMonthIndex]
      : null;

  // SoH calculations (based on Ca)
  const sohInfo = useMemo(() => {
    if (!records.length) return null;
    const initialCa = records[0].Ca ?? records[0].ca;
    const latestCa =
      records[records.length - 1].Ca ?? records[records.length - 1].ca;
    if (!initialCa || !latestCa) return null;

    const sohPct = (latestCa / initialCa) * 100;

    let status = "Unknown";
    let badgeColor = "bg-slate-500/20 text-slate-200";
    let commentary = "Not enough data to classify health.";

    if (sohPct >= 95) {
      status = "Excellent";
      badgeColor = "bg-emerald-500/20 text-emerald-300";
      commentary =
        "Pack is operating close to nominal capacity. No intervention required.";
    } else if (sohPct >= 90) {
      status = "Healthy";
      badgeColor = "bg-emerald-500/20 text-emerald-300";
      commentary = "Normal ageing observed. Continue regular monitoring.";
    } else if (sohPct >= 80) {
      status = "Monitor";
      badgeColor = "bg-amber-500/20 text-amber-300";
      commentary =
        "Noticeable capacity fade. Plan maintenance or pack rotation in the mid term.";
    } else {
      status = "Critical";
      badgeColor = "bg-red-500/20 text-red-300";
      commentary =
        "Capacity below 80% of nominal. Consider de-rating this vehicle or scheduling replacement.";
    }

    const yearlyFade =
      records.length > 1
        ? ((initialCa - latestCa) / initialCa) * (12 / records.length) * 100
        : 0;

    return {
      sohPct,
      status,
      badgeColor,
      commentary,
      initialCa,
      latestCa,
      yearlyFade,
    };
  }, [records]);

  const handleMonthSliderChange = (e) => {
    const idx = Number(e.target.value);
    setEndIndex(idx);
    if (idx < records.length) {
      setSelectedMonthIndex(idx);
      setMonthFilter(records[idx].monthKey);
    }
  };

  const handleMonthFilterChange = (e) => {
    const value = e.target.value;
    setMonthFilter(value);
    const idx = records.findIndex((r) => r.monthKey === value);
    if (idx !== -1) {
      setSelectedMonthIndex(idx);
      if (idx > endIndex) {
        setEndIndex(idx);
      }
    }
  };

  const chartCapacityData = filtered.map((r) => ({
    name: r.monthLabel,
    Ca: r.Ca,
  }));

  const chartThermalData = filtered.map((r) => ({
    name: r.monthLabel,
    Vpack: r.Vpack_ave,
    SOC: r.SOC_ave,
    Tmax: r.Tmax_ave,
    Tmin: r.Tmin_ave,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-bg-dark">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-bg-dark/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/fleet")}
              className="text-xs px-3 py-1 rounded-full border border-slate-700/80 text-slate-300 hover:border-accent-soft hover:text-accent-soft transition-colors"
            >
              ← Back to fleet
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Vehicle analytics
              </p>
              <h1 className="text-2xl font-semibold text-slate-50">
                EV-{String(vehicleId).padStart(2, "0")} health profile
              </h1>
            </div>
          </div>
          {sohInfo && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-400">Estimated SoH</p>
                <p className="text-2xl font-semibold text-slate-50">
                  {sohInfo.sohPct.toFixed(1)}%
                </p>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${sohInfo.badgeColor}`}
              >
                {sohInfo.status}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {loading && (
            <p className="text-sm text-slate-400">Loading vehicle data…</p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && (
            <>
              {/* Controls + SoH summary */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
              >
                <div className="lg:col-span-2 bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Time window
                  </p>
                  <p className="text-xs text-slate-400">
                    Drag the slider to choose how many months of history to
                    include in the plots.
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[0.7rem] text-slate-500 w-16">
                      From
                    </span>
                    <span className="text-[0.75rem] font-mono text-slate-200">
                      {records[0]?.monthLabel ?? "--"}
                    </span>
                    <span className="mx-1 text-slate-500">→</span>
                    <span className="text-[0.7rem] text-slate-500 w-16">
                      To
                    </span>
                    <span className="text-[0.75rem] font-mono text-slate-200">
                      {endIndex != null && records[endIndex]
                        ? records[endIndex].monthLabel
                        : "--"}
                    </span>
                  </div>
                  {records.length > 1 && (
                    <input
                      type="range"
                      min="0"
                      max={records.length - 1}
                      value={endIndex ?? 0}
                      onChange={handleMonthSliderChange}
                      className="w-full mt-2 accent-accent"
                    />
                  )}
                </div>

                <div className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Inspect specific month
                  </p>
                  <p className="text-xs text-slate-400">
                    Type or pick a month (YYYY-MM) to view detailed telemetry
                    for that period.
                  </p>
                  <input
                    type="month"
                    className="mt-2 w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-accent-soft"
                    value={monthFilter}
                    onChange={handleMonthFilterChange}
                  />
                  {selectedRecord && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div>
                        <p className="text-slate-400 mb-0.5">Capacity (Ca)</p>
                        <p className="font-semibold">
                          {selectedRecord.Ca?.toFixed(2) ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">SOC avg (%)</p>
                        <p className="font-semibold">
                          {selectedRecord.SOC_ave?.toFixed(1) ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Vpack avg (V)</p>
                        <p className="font-semibold">
                          {selectedRecord.Vpack_ave?.toFixed(1) ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">
                          Tmax / Tmin (°C)
                        </p>
                        <p className="font-semibold">
                          {selectedRecord.Tmax_ave?.toFixed(1) ?? "--"} /{" "}
                          {selectedRecord.Tmin_ave?.toFixed(1) ?? "--"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Charts */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {/* Capacity chart */}
                <div className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Capacity trajectory (Ca)
                    </h2>
                    <p className="text-[0.7rem] text-slate-500">
                      Monthly capacity / health indicator
                    </p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartCapacityData}>
                        <defs>
                          <linearGradient
                            id="capDetailGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#38bdf8"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#38bdf8"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            border: "1px solid #1e293b",
                            borderRadius: "0.75rem",
                            fontSize: "0.75rem",
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="Ca"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          fill="url(#capDetailGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Voltage / SOC / Temperature chart */}
                <div className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Voltage, SOC & temperature
                    </h2>
                    <p className="text-[0.7rem] text-slate-500">
                      Vpack, SOC, Tmax, Tmin over selected window
                    </p>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartThermalData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            border: "1px solid #1e293b",
                            borderRadius: "0.75rem",
                            fontSize: "0.75rem",
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: "0.7rem",
                            color: "#e2e8f0",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Vpack"
                          stroke="#38bdf8"
                          strokeWidth={1.8}
                          dot={false}
                          name="Vpack avg"
                        />
                        <Line
                          type="monotone"
                          dataKey="SOC"
                          stroke="#22c55e"
                          strokeWidth={1.4}
                          dot={false}
                          name="SOC avg"
                        />
                        <Line
                          type="monotone"
                          dataKey="Tmax"
                          stroke="#fb923c"
                          strokeWidth={1.4}
                          dot={false}
                          name="Tmax avg"
                        />
                        <Line
                          type="monotone"
                          dataKey="Tmin"
                          stroke="#f97373"
                          strokeWidth={1.4}
                          dot={false}
                          name="Tmin avg"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>

              {/* SoH commentary */}
              {sohInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                  className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">
                    Health interpretation
                  </p>
                  <p className="text-sm text-slate-200 mb-2">
                    Pack capacity has declined from{" "}
                    <span className="font-semibold">
                      {sohInfo.initialCa.toFixed(1)}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold">
                      {sohInfo.latestCa.toFixed(1)}
                    </span>{" "}
                    (SoH ≈{" "}
                    <span className="font-semibold">
                      {sohInfo.sohPct.toFixed(1)}%
                    </span>
                    ). Estimated annual fade rate is{" "}
                    <span className="font-semibold">
                      {sohInfo.yearlyFade.toFixed(2)}%/year
                    </span>
                    .
                  </p>
                  <p className="text-sm text-slate-300">
                    {sohInfo.commentary}
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
