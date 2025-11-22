// frontend/src/components/VehicleCard.jsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

function statusFromCapacity(capMin, capMax, source) {
  if (source === "local" || source === "registered" || capMax == null) {
    return {
      label: "Awaiting data",
      color: "bg-slate-600/40 text-slate-200",
    };
  }

  const latest = capMax;
  if (latest >= 130)
    return {
      label: "Healthy",
      color: "bg-emerald-500/20 text-emerald-300",
    };
  if (latest >= 120)
    return {
      label: "Warning",
      color: "bg-amber-500/20 text-amber-300",
    };
  return {
    label: "Critical",
    color: "bg-red-500/20 text-red-300",
  };
}

export default function VehicleCard({ vehicle }) {
  const {
    vehicle_id,
    n_samples,
    cap_min,
    cap_max,
    t_min,
    t_max,
    display_name,
    owner_name,
    source,
  } = vehicle;

  const status = statusFromCapacity(cap_min, cap_max, source);
  const navigate = useNavigate();

  const isLocal = source === "local";
  const isRegistered = source === "registered";
  const canNavigate = !(isLocal || isRegistered);

  const handleClick = () => {
    if (!canNavigate) return;
    navigate(`/vehicle/${vehicle_id}`);
  };

  const title =
    display_name ||
    `EV-${
      typeof vehicle_id === "number"
        ? String(vehicle_id).padStart(2, "0")
        : String(vehicle_id)
    }`;

  const samplesValue =
    typeof n_samples === "number" && n_samples >= 0 ? n_samples : 0;

  const capRangeText =
    typeof cap_min === "number" && typeof cap_max === "number"
      ? `${cap_min.toFixed(1)} – ${cap_max.toFixed(1)}`
      : "No telemetry yet";

  const firstMonthText = t_min ? String(t_min).slice(0, 7) : "--";
  const lastMonthText = t_max ? String(t_max).slice(0, 7) : "--";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={canNavigate ? handleClick : undefined}
      role={canNavigate ? "button" : "group"}
      className={`bg-bg-card/80 border border-slate-700/60 rounded-2xl p-4 shadow-soft-xl transition-all ${
        canNavigate
          ? "hover:shadow-2xl hover:border-accent-soft/70 cursor-pointer"
          : "opacity-90 cursor-not-allowed"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Vehicle
          </p>
          <p className="text-lg font-semibold text-slate-50">{title}</p>
          {owner_name && (
            <p className="text-[0.7rem] text-slate-400 mt-0.5">
              Owner: <span className="text-slate-200">{owner_name}</span>
            </p>
          )}
          {isLocal && (
            <p className="text-[0.7rem] text-slate-500 mt-0.5">
              Locally registered only · data pipeline not connected yet
            </p>
          )}
          {isRegistered && (
            <p className="text-[0.7rem] text-slate-500 mt-0.5">
              Registered fleet vehicle · telemetry will appear here as your data
              pipeline uploads monthly samples.
            </p>
          )}
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
        <div>
          <p className="text-slate-400 mb-0.5">Samples</p>
          <p className="font-semibold">{samplesValue}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-0.5">Cap. range</p>
          <p className="font-semibold">{capRangeText}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-0.5">First month</p>
          <p className="font-mono text-[0.7rem]">{firstMonthText}</p>
        </div>
        <div>
          <p className="text-slate-400 mb-0.5">Last month</p>
          <p className="font-mono text-[0.7rem]">{lastMonthText}</p>
        </div>
      </div>
    </motion.div>
  );
}
