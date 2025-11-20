// frontend/src/components/MessageFeed.jsx
import { motion } from "framer-motion";

const severityStyles = {
  info: {
    badge: "bg-sky-500/15 text-sky-300 border border-sky-500/40",
    dot: "bg-sky-400",
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-300 border border-amber-500/40",
    dot: "bg-amber-400",
  },
  critical: {
    badge: "bg-red-500/15 text-red-300 border border-red-500/40",
    dot: "bg-red-500",
  },
};

export default function MessageFeed({ messages, onDelete, onToggleSave }) {
  return (
    <div className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">
            Operations feed
          </p>
          <p className="text-[0.7rem] text-slate-500">
            Latest health alerts, SOH updates & ML-driven insights.
          </p>
        </div>
        <span className="text-[0.7rem] text-slate-500">
          {messages.length ? `${messages.length} events` : "No events yet"}
        </span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {!messages.length && (
          <p className="text-xs text-slate-500">
            Feed will populate automatically as telemetry and analytics
            generate events.
          </p>
        )}

        {messages.map((msg, idx) => {
          const s = severityStyles[msg.severity] || severityStyles.info;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, delay: idx * 0.02 }}
              className="bg-slate-900/70 border border-slate-700/80 rounded-xl px-3 py-2 text-xs flex flex-col gap-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${s.dot}`}
                  ></span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-50 text-[0.75rem]">
                        {msg.title}
                      </p>
                      {msg.vehicleLabel && (
                        <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-200 font-mono">
                          {msg.vehicleLabel}
                        </span>
                      )}
                      <span
                        className={`text-[0.6rem] px-2 py-0.5 rounded-full ${s.badge}`}
                      >
                        {msg.severity === "critical"
                          ? "Critical"
                          : msg.severity === "warning"
                          ? "Monitor"
                          : "Info"}
                      </span>
                    </div>
                    <p className="text-[0.7rem] text-slate-300 mt-0.5">
                      {msg.body}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[0.6rem] text-slate-500 font-mono">
                  {msg.timestamp}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSave?.(msg.id)}
                    className={`text-[0.65rem] px-2 py-0.5 rounded-full border ${
                      msg.saved
                        ? "border-emerald-500/70 text-emerald-300 bg-emerald-500/10"
                        : "border-slate-600 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-300"
                    }`}
                  >
                    {msg.saved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(msg.id)}
                    className="text-[0.65rem] px-2 py-0.5 rounded-full border border-slate-600 text-slate-300 hover:border-red-500/70 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
