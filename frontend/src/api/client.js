// frontend/src/api/client.js
import axios from "axios";

// FastAPI backend base URL
export const API_BASE = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
});

// -----------------------
// Fleet telemetry helpers
// -----------------------

// Demo fleet (20 vehicles)
export async function fetchVehicles() {
  const res = await api.get("/vehicles");
  // FleetOverview handles both {vehicles: [...]} and [...]
  // so returning res.data (which is { vehicles: [...] }) is fine.
  return res.data;
}

// Timeseries for one vehicle (VehicleDetail page)
export async function fetchVehicleTimeseries(vehicleId) {
  const res = await api.get(`/vehicles/${vehicleId}/timeseries`);
  return res.data;
}

// -----------------------
// Auth / operator account helpers
// -----------------------

export async function loginOperator(payload) {
  // payload: { operator_id, password }
  const res = await api.post("/auth/login", payload);
  return res.data;
}

export async function registerOperator(payload) {
  // payload: { email, password, employee_id }
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function requestPasswordReset(payload) {
  // payload: { email }
  const res = await api.post("/auth/forgot-password", payload);
  return res.data;
}

export async function resetPassword(payload) {
  // payload: { token, new_password }
  const res = await api.post("/auth/reset-password", payload);
  return res.data;
}

// -----------------------
// Operator-specific vehicles
// -----------------------

export async function fetchOperatorVehicles(operatorId) {
  if (!operatorId) return [];
  const res = await api.get(
    `/operators/${encodeURIComponent(operatorId)}/vehicles`
  );
  // backend returns { vehicles: [...] }
  return res.data.vehicles || res.data;
}

// Register a new vehicle for this operator (with optional consent PDF)
export async function registerOperatorVehicle(operatorId, form) {
  // `form` is the object from RegisterVehicleModal:
  // { vehicleName, regNumber, ownerName, monitoringMode, consentFile }
  const fd = new FormData();
  fd.append("vehicle_name", form.vehicleName || "");
  fd.append("reg_number", form.regNumber || "");
  fd.append("owner_name", form.ownerName || "");
  fd.append("monitoring_mode", form.monitoringMode || "monthly");

  if (form.consentFile instanceof File) {
    fd.append("consent_file", form.consentFile);
  }

  const res = await api.post(
    `/operators/${encodeURIComponent(operatorId)}/vehicles`,
    fd,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
}

// Delete a registered vehicle with a deletion-consent PDF
export async function deleteOperatorVehicle(operatorId, vehicleId, file) {
  if (!operatorId) {
    throw new Error("Missing operatorId for vehicle deletion");
  }
  if (!vehicleId) {
    throw new Error("Missing vehicleId for vehicle deletion");
  }
  if (!(file instanceof File)) {
    throw new Error("Deletion consent PDF is required");
  }

  const fd = new FormData();
  fd.append("deletion_consent", file);

  const res = await api.post(
    `/operators/${encodeURIComponent(
      operatorId
    )}/vehicles/${encodeURIComponent(vehicleId)}/delete`,
    fd,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
}

// -----------------------
// Helper: read stored operator from localStorage
// -----------------------

export function getStoredOperator() {
  try {
    // Prefer the new key
    let raw = localStorage.getItem("windgranma_operator");
    // Fallback to the older key with underscore if present
    if (!raw) {
      raw = localStorage.getItem("wind_granma_operator");
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse stored operator", e);
    return null;
  }
}
