// frontend/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import FleetOverview from "./pages/FleetOverview";
import VehicleDetail from "./pages/VehicleDetail";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword"; // NEW

function App() {
  return (
    <Routes>
      {/* Landing: login / register */}
      <Route path="/" element={<Login />} />

      {/* Dashboard */}
      <Route path="/fleet" element={<FleetOverview />} />
      <Route path="/vehicle/:vehicleId" element={<VehicleDetail />} />

      {/* Password reset (accessed from email link) */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
