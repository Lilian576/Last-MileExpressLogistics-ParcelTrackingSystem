import { API_BASE_URL, USE_MOCK } from "./parcelApi";
import { mockDriverLogin, mockDriverUpdateStatus, mockListAssigned } from "./mockBackend";
import { readError } from "./errors";
import { DriverParcel, DriverSession, ShipperAction } from "../types/driver";
import { ParcelStatus } from "../types/parcel";

// POST /auth/login (backend/src/auth) — chỉ nhận tài khoản role "shipper"
export async function driverLogin(email: string, password: string): Promise<DriverSession> {
  const session = USE_MOCK ? await mockDriverLogin(email, password) : await realLogin(email, password);
  if (session.user.role !== "shipper") {
    throw new Error("Tài khoản này không phải tài xế (cần role shipper).");
  }
  return session;
}

async function realLogin(email: string, password: string): Promise<DriverSession> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) throw new Error("Email hoặc mật khẩu không đúng");
  if (!res.ok) throw await readError(res, "Đăng nhập thất bại, vui lòng thử lại.");
  return res.json();
}

// GET /api/parcels/assigned/mine — đơn được giao cho tài xế đang đăng nhập
export async function listAssignedParcels(token: string): Promise<DriverParcel[]> {
  if (USE_MOCK) return mockListAssigned(token);
  const res = await fetch(`${API_BASE_URL}/api/parcels/assigned/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await readError(res, "Không tải được danh sách đơn được giao.");
  return res.json();
}

// PATCH /api/parcels/:id/status — backend (StateMachineService) kiểm tra lại mọi luật
export async function updateParcelStatus(
  token: string,
  parcel: DriverParcel,
  action: ShipperAction,
  hasDeliveryProof: boolean
): Promise<ParcelStatus> {
  if (USE_MOCK) {
    const r = await mockDriverUpdateStatus(token, parcel.id, action.event, { hasDeliveryProof });
    return r.currentStatus;
  }
  const body: Record<string, unknown> = { event: action.event };
  if (action.event === "confirm_pickup") body.isAssignedCourier = true; // đơn nằm trong danh sách của tài xế này
  if (action.needsProof) body.hasDeliveryProof = hasDeliveryProof;
  const res = await fetch(`${API_BASE_URL}/api/parcels/${parcel.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, "Cập nhật trạng thái thất bại.");
  const updated = (await res.json()) as { currentStatus: ParcelStatus };
  return updated.currentStatus;
}
