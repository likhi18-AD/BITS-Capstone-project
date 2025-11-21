// frontend/src/api/client.js
import axios from "axios";

// FastAPI backend
export const API_BASE = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,
});

// List vehicles (FleetOverview uses this)
export async function fetchVehicles() {
  const res = await api.get("/vehicles");
  // backend returns { vehicles: [...] }
  return res.data; // FleetOverview already does data.vehicles || data || []
}

// Timeseries for one vehicle (VehicleDetail page)
export async function fetchVehicleTimeseries(vehicleId) {
  const res = await api.get(`/vehicles/${vehicleId}/timeseries`);
  return res.data;
}

/* ---------- NEW: auth helpers ---------- */

// Registration: email + password + employee_id
export async function registerOperator(payload) {
  // payload = { email, password, employee_id }
  const res = await api.post("/auth/register", payload);
  // backend returns { operator_id, message }
  return res.data;
}

// Login: operator_id + password
export async function loginOperator(payload) {
  // payload = { operator_id, password }
  const res = await api.post("/auth/login", payload);
  // backend returns { operator_id, email, employee_id, message }
  return res.data;
}
// Request password reset email
export async function requestPasswordReset(email) {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data;
}

// Complete password reset using token from email link
export async function resetPassword(token, newPassword) {
  const res = await api.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return res.data;
}
