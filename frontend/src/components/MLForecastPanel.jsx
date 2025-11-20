// frontend/src/components/MLForecastPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./MLForecastPanel.css";
import { API_BASE } from "../api/client";

const MODEL_OPTIONS = [
  { label: "Seq2Seq + GPR", value: "seq2seq_gpr" },
  { label: "GPR (baseline)", value: "gpr" },
  { label: "SVR (baseline)", value: "svr" },
];

export default function MLForecastPanel({ isOpen, onClose, vehicles }) {
  // Ignore local vehicles whose IDs start with "L-"
  const backendVehicles = useMemo(
    () => (vehicles || []).filter((v) => !String(v.vehicle_id).startsWith("L-")),
    [vehicles]
  );

  const [vehicleId, setVehicleId] = useState("");
  const [modelKey, setModelKey] = useState("svr");
  const [nKnown, setNKnown] = useState(6);
  const [horizon, setHorizon] = useState(8);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // raw JSON from backend

  // When panel opens or vehicles change, pick first backend vehicle
  useEffect(() => {
    if (isOpen && backendVehicles.length > 0) {
      setVehicleId(String(backendVehicles[0].vehicle_id));
    }
  }, [isOpen, backendVehicles]);

  if (!isOpen) return null;

  const handleRunForecast = async () => {
    if (!vehicleId) {
      setStatus("Select a backend vehicle first.");
      return;
    }

    setLoading(true);
    setStatus("Running forecast...");
    setResult(null);

    try {
      const payload = {
        vehicle_id: Number(vehicleId),
        model: modelKey,
        n_known: Number(nKnown),
        horizon: Number(horizon),
      };

      const res = await fetch(`${API_BASE}/ml/forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setStatus("Forecast complete.");
    } catch (err) {
      console.error("Forecast error:", err);
      setStatus(`Forecast failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Tiny helper to build caption text under the plot
  const captionText = (() => {
    if (!result) return "";
    const {
      model_label,
      current_ca,
      last_predicted_ca,
      degradation_pct,
    } = result;

    if (
      typeof current_ca !== "number" ||
      typeof last_predicted_ca !== "number" ||
      typeof degradation_pct !== "number"
    ) {
      return "";
    }

    const label = model_label || modelKey.toUpperCase();
    const cur =
      current_ca && current_ca.toFixed ? current_ca.toFixed(2) : current_ca;
    const last =
      last_predicted_ca && last_predicted_ca.toFixed
        ? last_predicted_ca.toFixed(2)
        : last_predicted_ca;
    const pct =
      degradation_pct && degradation_pct.toFixed
        ? degradation_pct.toFixed(2)
        : degradation_pct;

    return `${label} predicts Ca from ${cur} Ah to ${last} Ah (${pct}% fade).`;
  })();

  return (
    <div className="mlForecastDrawer open">
      <div className="drawerHeader">
        <h2>ML Rolling Forecast</h2>
        <button className="closeBtn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="drawerControls">
        <label>Vehicle</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        >
          {backendVehicles.map((v) => (
            <option key={v.vehicle_id} value={v.vehicle_id}>
              {v.display_name || `EV-${String(v.vehicle_id).padStart(2, "0")}`}
            </option>
          ))}
        </select>

        <label>Model</label>
        <select
          value={modelKey}
          onChange={(e) => setModelKey(e.target.value)}
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <label>Months of known data (n_known)</label>
        <input
          type="number"
          min={1}
          max={24}
          value={nKnown}
          onChange={(e) => setNKnown(e.target.value)}
        />

        <label>Forecast horizon (months)</label>
        <input
          type="number"
          min={1}
          max={24}
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
        />

        <button
          className="runBtn"
          onClick={handleRunForecast}
          disabled={loading || !vehicleId}
        >
          {loading ? "Running…" : "Run forecast"}
        </button>

        {status && <div className="drawerMsg">{status}</div>}
      </div>

      <div className="drawerChart">
        {/* Beautiful PNG plot card */}
        {result && result.plot_png && (
          <div className="forecastPlotCard">
            <img
              src={`data:image/png;base64,${result.plot_png}`}
              alt="Capacity forecast plot"
              className="forecastPlotImg"
            />
            {captionText && (
              <div className="forecastPlotCaption">{captionText}</div>
            )}
          </div>
        )}

        {/* Raw JSON payload (for debugging / power users) */}
        {result ? (
          <pre
            style={{
              fontSize: "11px",
              backgroundColor: "#020617",
              borderRadius: "8px",
              padding: "8px",
              maxHeight: "220px",
              overflow: "auto",
              border: "1px solid #1e293b",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p className="drawerMsg">
            Run a forecast to see the prediction payload and plot here.
          </p>
        )}
      </div>
    </div>
  );
}

