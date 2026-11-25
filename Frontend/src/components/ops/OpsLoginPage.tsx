import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Field } from "../shared/Field";
import { opsLogin, OPS_UNAVAILABLE_IN_MOCK } from "../../api/opsApi";
import { USE_MOCK } from "../../api/parcelApi";
import { getOpsSession, saveOpsSession } from "../../lib/opsSession";

export function OpsLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getOpsSession()) return <Navigate to="/ops" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      saveOpsSession(await opsLogin(email.trim(), password));
      navigate("/ops", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-card driver-login">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>Đăng nhập vận hành</h3>
      {USE_MOCK && (
        <div className="notice notice-warn" role="alert">
          {OPS_UNAVAILABLE_IN_MOCK}
        </div>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          <input
            type="email"
            aria-label="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <button className="btn btn-primary" type="submit" disabled={submitting || USE_MOCK}>
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Dành cho tài khoản role <code>admin</code> hoặc <code>warehouse_staff</code>.
      </p>
    </div>
  );
}
