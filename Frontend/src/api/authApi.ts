import { API_BASE_URL, USE_MOCK } from "./parcelApi";
import { mockCustomerLogin, mockCustomerRegister } from "./mockBackend";
import { readError } from "./errors";
import { AuthSession, RegisterRequest } from "../types/auth";

// POST /auth/register — backend luôn tạo role "customer" (RegisterDto đã bỏ trường role,
// M3 vá lỗi leo thang đặc quyền) nên frontend KHÔNG gửi role.
export async function register(req: RegisterRequest): Promise<AuthSession> {
  if (USE_MOCK) return mockCustomerRegister(req);
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw await readError(res, "Đăng ký thất bại, vui lòng thử lại.");
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (USE_MOCK) return mockCustomerLogin(email, password);
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) throw new Error("Email hoặc mật khẩu không đúng");
  if (!res.ok) throw await readError(res, "Đăng nhập thất bại, vui lòng thử lại.");
  return res.json();
}
