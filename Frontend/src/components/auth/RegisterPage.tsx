import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Field } from "../shared/Field";
import { register } from "../../api/authApi";
import { getSession, saveSession } from "../../lib/session";

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/new";
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getSession()) return <Navigate to={from} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.fullName.trim()) e.fullName = "Vui lòng nhập họ tên";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Email không hợp lệ";
    if (!/^0\d{9}$/.test(form.phone)) e.phone = "SĐT không hợp lệ (VD: 0901234567)";
    if (form.password.length < 6) e.password = "Mật khẩu tối thiểu 6 ký tự";
    if (form.confirm !== form.password) e.confirm = "Mật khẩu nhập lại không khớp";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Backend trả luôn token sau khi đăng ký -> đăng nhập tự động
      const session = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone,
        password: form.password,
      });
      saveSession(session);
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-card driver-login">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>Đăng ký tài khoản</h3>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Họ tên" error={errors.fullName}>
          <input aria-label="Họ tên" value={form.fullName} onChange={set("fullName")} placeholder="Nguyễn Văn A" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" aria-label="Email" autoComplete="username" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Số điện thoại" error={errors.phone}>
          <input aria-label="Số điện thoại" value={form.phone} onChange={set("phone")} placeholder="09xxxxxxxx" />
        </Field>
        <Field label="Mật khẩu" error={errors.password}>
          <input type="password" aria-label="Mật khẩu" autoComplete="new-password" value={form.password} onChange={set("password")} />
        </Field>
        <Field label="Nhập lại mật khẩu" error={errors.confirm}>
          <input type="password" aria-label="Nhập lại mật khẩu" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </Field>
        {submitError && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {submitError}
          </div>
        )}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Đã có tài khoản? <Link to="/login" state={location.state}>Đăng nhập</Link>
      </p>
    </div>
  );
}
