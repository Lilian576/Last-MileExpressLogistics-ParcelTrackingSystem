import { NavLink, Route, Routes } from "react-router-dom";
import { Wizard } from "./components/wizard/Wizard";
import { TrackingPage } from "./components/tracking/TrackingPage";
import { OrdersPage } from "./components/orders/OrdersPage";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          Lẹ<span>Mail</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Tạo đơn
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? "active" : "")}>
            Đơn của tôi
          </NavLink>
          <NavLink to="/tracking" className={({ isActive }) => (isActive ? "active" : "")}>
            Tra cứu
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Wizard />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/tracking/:code" element={<TrackingPage />} />
      </Routes>
    </div>
  );
}
