import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "../../lib/session";

// Chưa đăng nhập -> chuyển sang /login, nhớ trang đang muốn vào để quay lại sau khi đăng nhập
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!getSession()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
