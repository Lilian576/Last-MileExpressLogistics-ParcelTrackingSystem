import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Field } from "../shared/Field";
import { driverLogin } from "../../api/driverApi";
import { USE_MOCK } from "../../api/parcelApi";
import { MOCK_DRIVER } from "../../api/mockBackend";
import { getDriverSession, saveDriverSession } from "../../lib/driverSession";

export function DriverLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getDriverSession()) return <Navigate to="/driver" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      saveDriverSession(await driverLogin(email.trim(), password));
      navigate("/driver", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-card driver-login">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>Đăng nhập tài xế</h3>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          <input
            type="email"
            aria-label="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tai.xe@example.com"
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            type="password"
            aria-label="Mật khẩu"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      {USE_MOCK && (
        <p className="muted" style={{ marginTop: 16 }}>
          🧪 Chế độ mock — tài khoản demo: <b>{MOCK_DRIVER.email}</b> / <b>{MOCK_DRIVER.password}</b>
        </p>
      )}
    </div>
  );
}
