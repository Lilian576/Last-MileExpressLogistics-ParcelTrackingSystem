import { useSyncExternalStore } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { Wizard } from "./components/wizard/Wizard";
import { TrackingPage } from "./components/tracking/TrackingPage";
import { OrdersPage } from "./components/orders/OrdersPage";
import { DriverLoginPage } from "./components/driver/DriverLoginPage";
import { DriverOrdersPage } from "./components/driver/DriverOrdersPage";
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { clearSession, getSession, SESSION_EVENT } from "./lib/session";

function subscribeSession(cb: () => void) {
  window.addEventListener(SESSION_EVENT, cb);
  window.addEventListener("storage", cb); // đăng nhập/xuất ở tab khác
  return () => {
    window.removeEventListener(SESSION_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// Snapshot phải là giá trị nguyên thủy (string) để useSyncExternalStore so sánh ổn định
const sessionToken = () => getSession()?.accessToken ?? "";

export default function App() {
  const navigate = useNavigate();
  const token = useSyncExternalStore(subscribeSession, sessionToken);
  const session = token ? getSession() : null;
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          Cloud<span>Ship</span>
        </div>
        <nav className="app-nav">
          <NavLink to="/new" className={cls}>
            Tạo đơn
          </NavLink>
          <NavLink to="/orders" className={cls}>
            Đơn của tôi
          </NavLink>
          <NavLink to="/tracking" className={cls}>
            Tra cứu
          </NavLink>
          <NavLink to="/driver" className={cls}>
            Tài xế
          </NavLink>
          {session ? (
            <a
              href="#logout"
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              title={session.user.email}
            >
              Đăng xuất ({session.user.fullName})
            </a>
          ) : (
            <NavLink to="/login" className={cls}>
              Đăng nhập
            </NavLink>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/new" replace />} />
        <Route
          path="/new"
          element={
            <ProtectedRoute>
              <Wizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/tracking/:code" element={<TrackingPage />} />
        <Route path="/driver/login" element={<DriverLoginPage />} />
        <Route path="/driver" element={<DriverOrdersPage />} />
      </Routes>
    </div>
  );
}
