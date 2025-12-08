// frontend/src/components/RegisterVehicleModal.jsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { registerOperatorVehicle } from "../api/client";

export default function RegisterVehicleModal({
  isOpen,
  onClose,
  onSave,
  operatorId, 
}) {
  const [vehicleName, setVehicleName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [monitoringMode, setMonitoringMode] = useState("monthly");
  const [consentFile, setConsentFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setVehicleName("");
    setRegNumber("");
    setOwnerName("");
    setMonitoringMode("monthly");
    setConsentFile(null);
    setError("");
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] ?? null;
    setConsentFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleName || !regNumber || !ownerName) {
      setError("Please fill in vehicle name, registration number and owner.");
      return;
    }
    if (!consentFile) {
      setError("Consent form is required before monitoring can start.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      let payloadForOnSave;

      if (operatorId) {
        const backendVehicle = await registerOperatorVehicle(operatorId, {
          vehicleName,
          regNumber,
          ownerName,
          monitoringMode,
          consentFile,
        });

        payloadForOnSave = backendVehicle;
      } else {
        payloadForOnSave = {
          vehicleName,
          regNumber,
          ownerName,
          monitoringMode,
          consentFileName: consentFile.name,
          source: "local",
        };
      }

      onSave?.(payloadForOnSave);
      resetForm();
    } catch (err) {
      console.error("Register vehicle failed:", err);
      setError(
        "Failed to register vehicle in backend. Please check your connection and try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg bg-bg-card/95 border border-slate-700/80 rounded-3xl shadow-soft-xl p-6"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Fleet setup
                </p>
                <h2 className="text-lg font-semibold text-slate-50">
                  Register new vehicle
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-100 text-sm px-2 py-1 rounded-full hover:bg-slate-700/70"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Vehicle name / number
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent-soft"
                    placeholder="e.g. EV-21, CityCab-R12"
                    value={vehicleName}
                    onChange={(e) => setVehicleName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Registration number
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent-soft"
                    placeholder="e.g. TS09 AB 1234"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Belongs to / operator
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-accent-soft"
                  placeholder="Fleet owner / company / driver"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-1">
                  Monitoring range (for this deployment)
                </p>
                <div className="inline-flex rounded-2xl bg-slate-900/70 border border-slate-700/80 p-1 text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={() => setMonitoringMode("monthly")}
                    className={`px-3 py-1 rounded-xl transition-colors ${
                      monitoringMode === "monthly"
                        ? "bg-accent-soft/90 text-slate-950"
                        : "hover:bg-slate-800/80"
                    }`}
                  >
                    Monthly time-series
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitoringMode("daily")}
                    className={`px-3 py-1 rounded-xl transition-colors ${
                      monitoringMode === "daily"
                        ? "bg-accent-soft/90 text-slate-950"
                        : "hover:bg-slate-800/80"
                    }`}
                  >
                    Daily time-series
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Consent form (PDF / image)
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/80 text-xs text-slate-100 cursor-pointer hover:border-accent-soft hover:text-accent-soft">
                    <span>Upload consent</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                  {consentFile && (
                    <p className="text-[0.7rem] text-slate-300 truncate max-w-[220px]">
                      {consentFile.name}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  {operatorId
                    ? "Consent file will be stored in the Wind Granma backend under your operator account."
                    : "This file is kept only in this browser demo – no backend upload is performed yet."}
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/50 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-200 hover:bg-slate-800/80"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-accent-soft text-xs font-medium text-slate-950 hover:bg-accent transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save & register"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
