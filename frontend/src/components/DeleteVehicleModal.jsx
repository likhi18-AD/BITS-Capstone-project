// frontend/src/components/DeleteVehicleModal.jsx
import { useState } from "react";
import { deleteOperatorVehicle } from "../api/client";

export default function DeleteVehicleModal({
  isOpen,
  onClose,
  vehicle,
  operatorId,
  onDeleted,
}) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !vehicle) return null;

  const handleBackdropClick = () => {
    if (!loading) {
      onClose && onClose();
    }
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setStatus("");
  };

  const handleDelete = async () => {
    if (!operatorId) {
      setStatus("Missing operator ID – please log in again.");
      return;
    }
    if (!file) {
      setStatus("Please upload the owner's deletion request PDF.");
      return;
    }

    setLoading(true);
    setStatus("Deleting vehicle…");

    try {
      await deleteOperatorVehicle(operatorId, vehicle.vehicle_id, file);
      setStatus("Vehicle deleted.");
      if (onDeleted) {
        onDeleted(vehicle.vehicle_id);
      }
      onClose && onClose();
      setFile(null);
    } catch (err) {
      console.error("Delete vehicle error:", err);
      setStatus(
        `Delete failed: ${
          err?.response?.data?.detail ||
          err?.message ||
          "Unexpected error occurred."
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const title =
    vehicle.display_name ||
    `EV-${
      typeof vehicle.vehicle_id === "number"
        ? String(vehicle.vehicle_id).padStart(2, "0")
        : String(vehicle.vehicle_id)
    }`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md bg-bg-card/95 border border-slate-700/80 rounded-2xl shadow-soft-xl p-4"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-400 mb-1">
              Delete registered vehicle
            </p>
            <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
          </div>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-200 text-sm px-2"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <p className="text-[0.75rem] text-slate-300 mb-3">
          This action will remove the vehicle and its associated monitoring data
          from your fleet registry. For compliance, please upload the owner&apos;s
          signed deletion request PDF.
        </p>

        {/* Styled upload section (matches RegisterVehicleModal) */}
        <div className="mb-3">
          <label className="block text-[0.7rem] text-slate-300 mb-1">
            Deletion consent PDF
          </label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-900/80 text-xs text-slate-100 cursor-pointer hover:border-accent-soft hover:text-accent-soft">
              <span>Upload deletion form</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {file && (
              <p className="text-[0.7rem] text-slate-300 truncate max-w-[220px]">
                {file.name}
              </p>
            )}
          </div>
          <p className="mt-1 text-[0.65rem] text-slate-500">
            Only PDF files are accepted. The document should clearly state the
            owner&apos;s request to stop monitoring and delete data.
          </p>
        </div>

        {status && (
          <p className="mt-1 text-[0.7rem] text-slate-300">{status}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-[0.7rem] rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800/80"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-[0.7rem] rounded-full bg-rose-500/90 text-slate-950 hover:bg-rose-400 disabled:opacity-60"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}
