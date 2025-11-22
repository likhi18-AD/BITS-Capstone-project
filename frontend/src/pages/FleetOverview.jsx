// frontend/src/pages/FleetOverview.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchVehicles,
  fetchOperatorVehicles,
  getStoredOperator,
} from "../api/client";
import VehicleCard from "../components/VehicleCard";
import RegisterVehicleModal from "../components/RegisterVehicleModal";
import MessageFeed from "../components/MessageFeed";
import IDBar from "../components/IDBar";
import MLForecastPanel from "../components/MLForecastPanel";

// --- helper to generate realistic EV health messages --- //
function generateRandomMessage(vehicles) {
  if (!vehicles.length) return null;
  const v = vehicles[Math.floor(Math.random() * vehicles.length)];
  const vid = v.vehicle_id;
  const label = `EV-${String(vid).padStart(2, "0")}`;
  const baseCa = typeof v.cap_max === "number" ? v.cap_max : 130;
  const soh = Math.max(
    70,
    Math.min(102, (baseCa / 140) * 100 + (Math.random() * 4 - 2))
  ).toFixed(1);

  const templates = [
    {
      severity: "warning",
      title: "Capacity fade trending up",
      body: `Estimated SOH for ${label} is ${soh}%. Rolling 6-month trend shows a linear decline of ~0.6%/month. Recommend scheduling mid-term pack inspection if SOH drops below 80%.`,
    },
    {
      severity: "info",
      title: "Thermal profile within limits",
      body: `${label} reported Tmax below 40 °C and Tmin above 15 °C for the last duty cycle. Thermal gradients are within nominal envelope; cooling loop behaving as expected.`,
    },
    {
      severity: "critical",
      title: "High internal resistance indicator",
      body: `${label} shows increased voltage sag at peak current. Derived internal resistance has risen by ~18% vs initial commissioning. Consider derating fast-charge power until the next maintenance window.`,
    },
    {
      severity: "warning",
      title: "SOC window utilisation high",
      body: `${label} spends >82% of operating time between 15–95% SOC. Long-term calendar + cycling ageing may accelerate; suggest tightening usable SOC window to 20–90% for life-extension mode.`,
    },
  ];

  const t = templates[Math.floor(Math.random() * templates.length)];
  const now = new Date();
  return {
    id: `msg-${now.getTime()}-${Math.round(Math.random() * 1e4)}`,
    vehicleId: vid,
    vehicleLabel: label,
    severity: t.severity,
    title: t.title,
    body: t.body,
    timestamp: now.toLocaleTimeString(),
    saved: false,
  };
}

export default function FleetOverview() {
  const navigate = useNavigate();
  const [remoteVehicles, setRemoteVehicles] = useState([]);
  const [localVehicles, setLocalVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // operator + per-operator vehicles
  const [operator, setOperator] = useState(null);
  const [operatorVehicles, setOperatorVehicles] = useState([]);

  // message feed + saved IDs
  const [messages, setMessages] = useState([]);
  const [idItems, setIdItems] = useState([]);

  const [isForecastOpen, setIsForecastOpen] = useState(false);

  // vehicle list UX
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleListExpanded, setVehicleListExpanded] = useState(false);

  // --- load vehicles from backend (demo fleet) --- //
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchVehicles();
        if (cancelled) return;
        const list = data.vehicles || data || [];
        setRemoteVehicles(list);
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load vehicles from backend.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- load operator + per-operator vehicles --- //
  useEffect(() => {
    const op = getStoredOperator();
    if (!op) {
      navigate("/");
      return;
    }
    setOperator(op);

    let cancelled = false;

    async function loadOperatorVehicles() {
      try {
        const list = await fetchOperatorVehicles(op.operator_id);
        if (cancelled) return;
        setOperatorVehicles(list || []);
      } catch (err) {
        console.error("Failed to load operator vehicles", err);
      }
    }

    loadOperatorVehicles();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // --- auto-generate messages every 2 minutes based on remote vehicles --- //
  useEffect(() => {
    if (!remoteVehicles.length) return;

    // seed initial messages
    const seed = [];
    for (let i = 0; i < Math.min(3, remoteVehicles.length); i += 1) {
      const msg = generateRandomMessage(remoteVehicles);
      if (msg) seed.push(msg);
    }
    setMessages(seed);

    const interval = setInterval(() => {
      setMessages((prev) => {
        const msg = generateRandomMessage(remoteVehicles);
        if (!msg) return prev;
        const next = [msg, ...prev];
        // keep last 30
        return next.slice(0, 30);
      });
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [remoteVehicles]);

  const allVehicles = useMemo(
    () => [...remoteVehicles, ...operatorVehicles, ...localVehicles],
    [remoteVehicles, operatorVehicles, localVehicles]
  );

  const fleetSize = allVehicles.length;

  const avgLatestCapacity = useMemo(() => {
    const valid = remoteVehicles.filter(
      (v) => typeof v.cap_max === "number" && !Number.isNaN(v.cap_max)
    );
    if (!valid.length) return null;
    const sum = valid.reduce((acc, v) => acc + v.cap_max, 0);
    return sum / valid.length;
  }, [remoteVehicles]);

  const snapshotData = useMemo(() => {
    return remoteVehicles
      .filter(
        (v) => typeof v.cap_max === "number" && !Number.isNaN(v.cap_max)
      )
      .map((v) => ({
        name: `EV-${String(v.vehicle_id).padStart(2, "0")}`,
        Ca: v.cap_max,
      }));
  }, [remoteVehicles]);

  // --- filtered vehicles for search --- //
  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return allVehicles;

    return allVehicles.filter((v) => {
      const pieces = [
        v.display_name,
        v.owner_name,
        v.reg_number,
        v.vehicle_id && `EV-${String(v.vehicle_id).padStart(2, "0")}`,
        String(v.vehicle_id),
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return pieces.some((p) => p.includes(q));
    });
  }, [allVehicles, vehicleQuery]);

  const handleOpenRegister = () => {
    setIsRegisterOpen(true);
  };
  const handleLogout = () => {
    try {
      // clear both possible keys just in case
      window.localStorage.removeItem("windgranma_operator");
      window.localStorage.removeItem("wind_granma_operator");
    } catch (e) {
      console.error("Failed to clear operator info", e);
    }
    navigate("/");
  };

  const handleSaveVehicle = (saved) => {
    // If this came from backend (per-operator registered vehicle)
    if (saved && saved.source === "registered") {
      const v = saved;

      setOperatorVehicles((prev) => [...prev, v]);

      const now = new Date();
      setIdItems((prev) => [
        {
          id: v.vehicle_id,
          vehicleName: v.display_name,
          timestamp: now.toLocaleString(),
        },
        ...prev,
      ]);

      setIsRegisterOpen(false);
      return;
    }

    // Fallback: original purely local behaviour
    const form = saved;
    const uniqueId = `L-${Date.now().toString(36)}-${Math.round(
      Math.random() * 1e4
    ).toString(36)}`;

    const newVehicle = {
      vehicle_id: uniqueId,
      display_name: form.vehicleName || `EV-${uniqueId}`,
      reg_number: form.regNumber,
      owner_name: form.ownerName,
      monitoring_mode: form.monitoringMode,
      consent_file: form.consentFileName,
      n_samples: 0,
      cap_min: null,
      cap_max: null,
      t_min: null,
      t_max: null,
      source: "local",
    };

    setLocalVehicles((prev) => [...prev, newVehicle]);

    const now = new Date();
    setIdItems((prev) => [
      {
        id: uniqueId,
        vehicleName: newVehicle.display_name,
        timestamp: now.toLocaleString(),
      },
      ...prev,
    ]);

    setIsRegisterOpen(false);
  };

  // message actions
  const handleDeleteMessage = (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleToggleSaveMessage = (id) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              saved: !m.saved,
            }
          : m
      )
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-dark">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-bg-dark/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Fleet analytics
            </p>
            <h1 className="text-2xl font-semibold text-slate-50">
              EV Battery Health Overview
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl border border-slate-700/80 text-xs text-slate-300 hover:bg-slate-800/80 hover:text-rose-300 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Logout</span>
            </button>

            <button
              onClick={handleOpenRegister}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-accent-soft/60 text-xs text-slate-100 hover:bg-accent-soft hover:text-slate-950 hover:border-accent-soft transition-colors"
            >
              <span className="text-sm">＋</span>
              <span>Register vehicle</span>
            </button>

            <button
              onClick={() => setIsForecastOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-500/90 text-xs font-medium text-slate-950 shadow-soft-xl hover:bg-sky-400 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-slate-900/70" />
              <span>ML forecast</span>
            </button>

            <div className="flex items-center gap-3">
              <p className="text-xs text-emerald-300 font-medium">
                FastAPI · GPR/Seq2Seq
              </p>
              <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-xs font-semibold text-slate-950 shadow-soft-xl">
                EV
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Fleet size */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">
                Fleet size
              </p>
              <p className="text-3xl font-semibold text-slate-50">
                {fleetSize}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Vehicles with monthly health history
                {localVehicles.length > 0 && (
                  <>
                    {" · "}
                    <span className="text-sky-300">
                      {localVehicles.length} locally registered
                    </span>
                  </>
                )}
              </p>
            </motion.div>

            {/* Avg latest capacity */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.02 }}
              className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">
                Avg latest capacity
              </p>
              <p className="text-3xl font-semibold text-slate-50">
                {avgLatestCapacity != null
                  ? avgLatestCapacity.toFixed(1)
                  : "--"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                From aggregated feature dataframe (Ca)
              </p>
            </motion.div>

            {/* Data coverage (static for now) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.04 }}
              className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">
                Data coverage
              </p>
              <p className="text-3xl font-semibold text-slate-50">
                2019–2021
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Monthly telemetry per vehicle (SOC, Vpack, T)
              </p>
            </motion.div>
          </div>

          {/* Body: left (chart + feed) and right (vehicles + IDs) */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-6">
            {/* LEFT COLUMN */}
            <div>
              {/* Capacity snapshot chart */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">
                      Fleet capacity snapshot
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      Latest Ca per vehicle (higher is healthier)
                    </p>
                  </div>
                  <button
                    onClick={handleOpenRegister}
                    className="inline-flex sm:hidden items-center gap-1 px-3 py-1.5 rounded-xl border border-accent-soft/50 text-[0.7rem] text-slate-100 hover:bg-accent-soft hover:text-slate-950"
                  >
                    <span className="text-sm">＋</span>
                    <span>Register vehicle</span>
                  </button>
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={snapshotData}>
                      <defs>
                        <linearGradient
                          id="fleetCapGradient"
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
                        fill="url(#fleetCapGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Operations / news feed */}
              <MessageFeed
                messages={messages}
                onDelete={handleDeleteMessage}
                onToggleSave={handleToggleSaveMessage}
              />
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col">
              {/* Vehicles list */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.04 }}
                className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      Vehicles
                    </p>
                    <p className="text-[0.7rem] text-slate-500">
                      Search and click a backend-connected vehicle to inspect
                      its health profile.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVehicleListExpanded((prev) => !prev)
                    }
                    className="text-[0.7rem] px-3 py-1.5 rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-800/80"
                  >
                    {vehicleListExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>

                {/* Search bar */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={vehicleQuery}
                    onChange={(e) => setVehicleQuery(e.target.value)}
                    placeholder="Search by EV ID, name, reg. number or owner"
                    className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-accent-soft"
                  />
                </div>

                <div
                  className={`space-y-3 pr-1 overflow-y-auto ${
                    vehicleListExpanded ? "max-h-[40rem]" : "max-h-[24rem]"
                  }`}
                >
                  {loading && (
                    <p className="text-xs text-slate-400">
                      Loading vehicles from backend…
                    </p>
                  )}
                  {error && (
                    <p className="text-xs text-red-400">{error}</p>
                  )}
                  {!loading &&
                    !filteredVehicles.length &&
                    !error && (
                      <p className="text-xs text-slate-400">
                        No vehicles match this search query.
                      </p>
                    )}
                  {filteredVehicles.map((v) => (
                    <VehicleCard key={v.vehicle_id} vehicle={v} />
                  ))}
                </div>
              </motion.div>

              {/* ID bar under vehicles */}
              <IDBar items={idItems} />
            </div>
          </div>
        </div>
      </main>

      {/* ML forecast side panel */}
      <MLForecastPanel
        isOpen={isForecastOpen}
        onClose={() => setIsForecastOpen(false)}
        vehicles={remoteVehicles}
      />

      {/* Register vehicle modal */}
      <RegisterVehicleModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSave={handleSaveVehicle}
        operatorId={operator?.operator_id}
      />
    </div>
  );
}
