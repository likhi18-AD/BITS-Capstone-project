// frontend/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import FleetOverview from "./pages/FleetOverview";
import VehicleDetail from "./pages/VehicleDetail";
import Login from "./pages/Login";

function App() {
  return (
    <Routes>
      {/* Landing: login / register */}
      <Route path="/" element={<Login />} />

      {/* Dashboard */}
      <Route path="/fleet" element={<FleetOverview />} />
      <Route path="/vehicle/:vehicleId" element={<VehicleDetail />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
