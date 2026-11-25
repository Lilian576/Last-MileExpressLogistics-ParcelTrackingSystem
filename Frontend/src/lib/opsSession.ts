import { OpsSession } from "../types/ops";

// Phiên của nhân viên vận hành (admin / warehouse_staff), tách khỏi phiên khách và tài xế
const KEY = "lemail.opsSession";

export function getOpsSession(): OpsSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as OpsSession;
    return s?.accessToken && s?.user ? s : null;
  } catch {
    return null;
  }
}

export function saveOpsSession(session: OpsSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // localStorage bị chặn: phiên chỉ sống trong state của trang
  }
}

export function clearOpsSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
