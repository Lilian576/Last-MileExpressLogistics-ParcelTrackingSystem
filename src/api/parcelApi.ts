import { io, Socket } from "socket.io-client";
import {
  CreateParcelRequest,
  Parcel,
  ParcelStatus,
  QuoteRequest,
  QuoteResponse,
} from "../types/parcel";
import { mockCreateParcel, mockGetQuote, mockJoinRoom, mockListParcels, mockTrackParcel } from "./mockBackend";
import { getMyTrackingCodes } from "../lib/myOrders";

// ================================================================
// ĐỔI CHỖ NÀY khi backend thật (ParcelModule + TrackingGateway) sẵn sàng
// ================================================================
export const USE_MOCK = true;
export const API_BASE_URL = "http://localhost:3000"; // API domain của backend
export const SOCKET_URL = "http://localhost:3000"; // Socket.io server URL

// Tuần 3: M2 mới có API PATCH status (REST), chưa có TrackingGateway
// (WebSocket) — nên TrackingPage tạm cập nhật bằng polling.
// Tuần 4: M2 dựng xong TrackingGateway thì đổi dòng dưới thành "websocket",
// TrackingPage không cần sửa gì thêm vì đã tách qua subscribeToParcel().
export const REALTIME_MODE: "polling" | "websocket" = "polling";
export const POLLING_INTERVAL_MS = 4000;
// ================================================================

export async function getQuote(req: QuoteRequest): Promise<QuoteResponse> {
  if (USE_MOCK) return mockGetQuote(req);
  const res = await fetch(`${API_BASE_URL}/api/parcels/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Không tính được phí ship, vui lòng thử lại.");
  return res.json();
}

export async function createParcel(req: CreateParcelRequest): Promise<Parcel> {
  if (USE_MOCK) return mockCreateParcel(req);
  const res = await fetch(`${API_BASE_URL}/api/parcels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Tạo đơn thất bại, vui lòng thử lại.");
  return res.json();
}

export async function trackParcel(trackingCode: string): Promise<Parcel | null> {
  if (USE_MOCK) return mockTrackParcel(trackingCode);
  const res = await fetch(`${API_BASE_URL}/api/public/track/${trackingCode}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Không tra cứu được đơn hàng.");
  return res.json();
}

// ---- Danh sách đơn của tôi ----
// TODO(M3 xong AuthModule): thay bằng GET /api/parcels/mine + header
// `Authorization: Bearer <jwt>`, bỏ phụ thuộc localStorage. UI (OrdersPage)
// không cần đổi gì vì đã tách qua hàm này.
export async function listMyParcels(): Promise<Parcel[]> {
  const codes = getMyTrackingCodes();
  if (codes.length === 0) return [];
  if (USE_MOCK) return mockListParcels(codes);
  const res = await fetch(`${API_BASE_URL}/api/parcels/mine`, {
    // Tạm thời gửi kèm codes vì chưa có JWT thật; backend thật sẽ bỏ qua
    // field này và lấy theo user đăng nhập.
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingCodes: codes }),
  });
  if (!res.ok) throw new Error("Không tải được danh sách đơn hàng.");
  return res.json();
}

const TERMINAL_STATUSES: ParcelStatus[] = ["DELIVERED", "RETURNED"];

// ---- Chế độ Tuần 3: polling REST (chưa có WebSocket) ----
// Gọi lại GET /api/public/track/:code định kỳ, tự dừng khi đơn về trạng
// thái cuối (DELIVERED/RETURNED) hoặc khi component unmount.
function subscribeToParcelPolling(
  trackingCode: string,
  onUpdate: (parcel: Parcel) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  let stopped = false;
  onConnectionChange?.(true);

  const tick = async () => {
    if (stopped) return;
    try {
      const parcel = await trackParcel(trackingCode);
      if (stopped) return;
      if (parcel) {
        onUpdate(parcel);
        if (TERMINAL_STATUSES.includes(parcel.currentStatus)) {
          onConnectionChange?.(false); // đơn đã kết thúc, không cần poll nữa
          return;
        }
      }
      onConnectionChange?.(true);
    } catch {
      onConnectionChange?.(false);
    }
    if (!stopped) timer = setTimeout(tick, POLLING_INTERVAL_MS);
  };

  let timer = setTimeout(tick, POLLING_INTERVAL_MS);

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// ---- Chế độ Tuần 4: WebSocket real-time (TrackingGateway) ----
function subscribeToParcelWebSocket(
  trackingCode: string,
  onUpdate: (parcel: Parcel) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  if (USE_MOCK) {
    onConnectionChange?.(true);
    return mockJoinRoom(trackingCode, onUpdate);
  }

  const socket: Socket = io(SOCKET_URL, { transports: ["websocket"] });

  socket.on("connect", () => onConnectionChange?.(true));
  socket.on("disconnect", () => onConnectionChange?.(false));
  socket.emit("join:parcel", { trackingCode });

  socket.on("parcel.status.updated", (parcel: Parcel) => onUpdate(parcel));
  socket.on("parcel.delivery.completed", (parcel: Parcel) => onUpdate(parcel));

  return () => {
    socket.emit("leave:parcel", { trackingCode });
    socket.disconnect();
  };
}

// ---- Real-time subscription (entry point dùng chung cho TrackingPage) ----
// Trả về hàm cleanup để gọi khi component unmount (đóng socket / dừng polling).
export function subscribeToParcel(
  trackingCode: string,
  onUpdate: (parcel: Parcel) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  if (REALTIME_MODE === "polling") {
    return subscribeToParcelPolling(trackingCode, onUpdate, onConnectionChange);
  }
  return subscribeToParcelWebSocket(trackingCode, onUpdate, onConnectionChange);
}

export type { ParcelStatus };
