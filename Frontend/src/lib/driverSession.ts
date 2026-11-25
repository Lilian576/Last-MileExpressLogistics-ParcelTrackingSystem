import { DriverSession } from "../types/driver";

const KEY = "lemail.driverSession";

export function getDriverSession(): DriverSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DriverSession;
    return s?.accessToken && s?.user ? s : null;
  } catch {
    return null;
  }
}

export function saveDriverSession(session: DriverSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // localStorage bị chặn: phiên chỉ sống trong state của trang
  }
}

export function clearDriverSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
