import { AuthSession } from "../types/auth";

// Phiên đăng nhập của KHÁCH (customer). Phiên tài xế tách riêng ở driverSession.ts
// để một trình duyệt có thể đăng nhập cả hai vai mà không đè token của nhau.
const KEY = "lemail.customerSession";

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    return s?.accessToken && s?.user ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // localStorage bị chặn: bỏ qua, phiên chỉ sống trong state của trang
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

// Để thanh điều hướng cập nhật ngay khi đăng nhập/đăng xuất
export const SESSION_EVENT = "lemail:session-changed";
