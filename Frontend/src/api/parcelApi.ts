import { io, Socket } from "socket.io-client";
import {
  CreateParcelRequest,
  Parcel,
  ParcelEvent,
  ParcelStatus,
  ParcelStatusUpdate,
  QuoteRequest,
  QuoteResponse,
  TERMINAL_STATUSES,
} from "../types/parcel";
import { mockCreateParcel, mockGetQuote, mockJoinRoom, mockListParcels, mockTrackParcel } from "./mockBackend";
import { getMyTrackingCodes } from "../lib/myOrders";
import { applyStatusUpdate, isSnapshotFresh } from "../lib/parcelUpdates";

// ================================================================
// ĐỔI CHỖ NÀY khi backend thật (ParcelModule + TrackingGateway) sẵn sàng
// ================================================================
// Có thể ghi đè bằng biến môi trường Vite (file .env.local, xem .env.example) mà không cần sửa code:
//   VITE_USE_MOCK=false VITE_API_BASE_URL=http://localhost:3000 npm run dev
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"; // NestJS thật, không có global prefix
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL; // Socket.io server URL

// "websocket": TrackingGateway (backend/src/tracking) phát `parcel.status.updated`
// mỗi khi PATCH /api/parcels/:id/status thành công. "polling" là phương án dự phòng.
export const REALTIME_MODE: "polling" | "websocket" = "websocket";
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
  const res = await fetch(`${API_BASE_URL}/api/public/track/${encodeURIComponent(trackingCode)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Không tra cứu được đơn hàng.");
  return toParcel((await res.json()) as PublicTrackResponse);
}

// Backend chỉ trả thông tin tối thiểu cho tra cứu công khai (không có SĐT, địa chỉ,
// thông tin người gửi) -> các trường còn lại của Parcel để rỗng, UI không dùng tới.
interface PublicTrackResponse {
  trackingCode: string;
  currentStatus: ParcelStatus;
  receiverName: string;
  history: ParcelEvent[];
}

function toParcel(r: PublicTrackResponse): Parcel {
  const empty = { fullName: "", phone: "", addressLine: "", province: "" };
  return {
    trackingCode: r.trackingCode,
    sender: { ...empty },
    receiver: { ...empty, fullName: r.receiverName },
    packageInfo: { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, category: "OTHER" },
    feeVnd: 0,
    currentStatus: r.currentStatus,
    history: r.history,
  };
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingCodes: codes }),
  });
  if (!res.ok) throw new Error("Không tải được danh sách đơn hàng.");
  return res.json();
}

// ---- Chế độ Tuần 3: polling REST (chưa có WebSocket) ----
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
// Giữ 1 bản Parcel "nền" trong closure; mỗi event `parcel.status.updated` (chỉ là
// bản vá: trạng thái mới + 1 mốc lịch sử) được ghép vào đó rồi đẩy lên UI.
function subscribeToParcelWebSocket(
  trackingCode: string,
  onUpdate: (parcel: Parcel) => void,
  onConnectionChange?: (connected: boolean) => void
): () => void {
  let stopped = false;
  let latest: Parcel | null = null;

  // Lấy snapshot REST rồi đồng bộ lại. Gọi khi (re)connect để bù các event bị rớt
  // lúc mất mạng, và khi nhận bản vá mà chưa có bản nền.
  const resync = () =>
    trackParcel(trackingCode)
      .then((fresh) => {
        if (stopped || !fresh || !isSnapshotFresh(fresh, latest)) return;
        latest = fresh;
        onUpdate(fresh);
      })
      .catch(() => {
        /* giữ nguyên dữ liệu cũ trên UI nếu resync lỗi, không chặn luồng */
      });

  const handleStatus = (update: ParcelStatusUpdate) => {
    if (stopped || update.trackingCode !== trackingCode) return;
    if (!latest) {
      void resync();
      return;
    }
    latest = applyStatusUpdate(latest, update);
    onUpdate(latest);
  };

  if (USE_MOCK) {
    onConnectionChange?.(true);
    const leave = mockJoinRoom(trackingCode, handleStatus);
    void resync();
    return () => {
      stopped = true;
      leave();
    };
  }

  const socket: Socket = io(SOCKET_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 5000,
  });

  // Mỗi lần connect (lần đầu HOẶC sau khi tự reconnect) phải join lại room —
  // server không nhớ room của socket cũ — rồi resync snapshot.
  socket.on("connect", () => {
    onConnectionChange?.(true);
    socket.emit("join:parcel", { trackingCode });
    void resync();
  });

  socket.on("disconnect", () => onConnectionChange?.(false));
  socket.on("connect_error", () => onConnectionChange?.(false));

  socket.on("parcel.status.updated", handleStatus);
  socket.on("parcel.delivery.completed", handleStatus);

  return () => {
    stopped = true;
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
