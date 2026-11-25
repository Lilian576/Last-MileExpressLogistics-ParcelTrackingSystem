import { API_BASE_URL, USE_MOCK } from "./parcelApi";
import { readError } from "./errors";
import { AssignCourierResult, OPS_ROLES, OpsParcel, OpsSession } from "../types/ops";
import { ParcelStatus } from "../types/parcel";

// Màn hình vận hành chỉ chạy với backend thật: không có mock để tránh "nghiệm thu" trên dữ liệu giả.
export const OPS_UNAVAILABLE_IN_MOCK = "Màn hình vận hành chỉ chạy với backend thật (đặt VITE_USE_MOCK=false).";

function guardReal() {
  if (USE_MOCK) throw new Error(OPS_UNAVAILABLE_IN_MOCK);
}

async function request(url: string, init: RequestInit, fallback: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng rồi thử lại.");
  }
  if (!res.ok) throw await readError(res, fallback);
  return res;
}

const bearer = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });

// POST /auth/login — chỉ nhận role admin / warehouse_staff
export async function opsLogin(email: string, password: string): Promise<OpsSession> {
  guardReal();
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch(() => {
    throw new Error("Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng rồi thử lại.");
  });
  if (res.status === 401) throw new Error("Email hoặc mật khẩu không đúng");
  if (!res.ok) throw await readError(res, "Đăng nhập thất bại, vui lòng thử lại.");
  const session = (await res.json()) as OpsSession;
  if (!OPS_ROLES.includes(session.user.role)) {
    throw new Error("Tài khoản này không phải nhân viên vận hành (cần role admin hoặc warehouse_staff).");
  }
  return session;
}

// GET /api/parcels — toàn bộ đơn (backend chưa có route tìm kiếm riêng nên lọc phía client)
export async function listAllParcels(token: string): Promise<OpsParcel[]> {
  guardReal();
  const res = await request(`${API_BASE_URL}/api/parcels`, { headers: bearer(token) }, "Không tải được danh sách đơn.");
  return (await res.json()) as OpsParcel[];
}

// PATCH /api/parcels/:id/assign-courier { pickupLat, pickupLng }
export async function assignCourier(
  token: string,
  parcelId: string,
  pickupLat: number,
  pickupLng: number
): Promise<AssignCourierResult> {
  guardReal();
  const res = await request(
    `${API_BASE_URL}/api/parcels/${parcelId}/assign-courier`,
    { method: "PATCH", headers: bearer(token), body: JSON.stringify({ pickupLat, pickupLng }) },
    "Gán tài xế thất bại."
  );
  return (await res.json()) as AssignCourierResult;
}

// PATCH /api/parcels/:id/status { event, ...guard } — StateMachineService kiểm tra lại ở backend
export async function opsUpdateStatus(
  token: string,
  parcelId: string,
  event: string,
  context: Record<string, boolean> = {}
): Promise<ParcelStatus> {
  guardReal();
  const res = await request(
    `${API_BASE_URL}/api/parcels/${parcelId}/status`,
    { method: "PATCH", headers: bearer(token), body: JSON.stringify({ event, ...context }) },
    "Cập nhật trạng thái thất bại."
  );
  return ((await res.json()) as { currentStatus: ParcelStatus }).currentStatus;
}
