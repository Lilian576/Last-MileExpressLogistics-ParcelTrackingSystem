import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Field } from "../shared/Field";
import { login } from "../../api/authApi";
import { getSession, saveSession } from "../../lib/session";
import { USE_MOCK } from "../../api/parcelApi";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/new";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getSession()) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(email.trim(), password);
      if (session.user.role !== "customer") {
        throw new Error("Đây là tài khoản nội bộ (tài xế/quản trị), vui lòng đăng nhập ở trang Tài xế.");
      }
      saveSession(session);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-card driver-login">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>Đăng nhập</h3>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          <input
            type="email"
            aria-label="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
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
      <p className="muted" style={{ marginTop: 16 }}>
        Chưa có tài khoản? <Link to="/register" state={location.state}>Đăng ký</Link>
      </p>
      {USE_MOCK && <p className="muted">🧪 Chế độ mock — hãy đăng ký một tài khoản bất kỳ để thử.</p>}
    </div>
  );
}
