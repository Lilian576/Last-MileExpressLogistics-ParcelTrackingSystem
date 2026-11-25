import { io, Socket } from "socket.io-client";
import {
  CreateParcelRequest,
  Parcel,
  ParcelEvent,
  ParcelStatus,
  ParcelStatusUpdate,
  ParcelLocationUpdate,
  QuoteRequest,
  QuoteResponse,
} from "../types/parcel";
import {
  mockCreateParcel,
  mockGetQuote,
  mockJoinLocation,
  mockJoinRoom,
  mockListParcels,
  mockTrackParcel,
} from "./mockBackend";
import { getSession } from "../lib/session";
import { AuthExpiredError, readError } from "./errors";
import {
  BackendParcel,
  fromBackendParcel,
  toCreateParcelDto,
  toFeeRequest,
  toQuoteResponse,
} from "./contract";
import { applyStatusUpdate, isSnapshotFresh } from "../lib/parcelUpdates";

// ================================================================
// CẤU HÌNH KẾT NỐI BACKEND
// ================================================================
// Mặc định gọi backend thật (NestJS). Muốn chạy không cần backend (demo UI), đặt
// VITE_USE_MOCK=true trong .env.local (xem .env.example):
//   VITE_USE_MOCK=true npm run dev
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"; // NestJS thật, không có global prefix
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL; // Socket.io server URL

// ================================================================

// Header JWT cho các API cần đăng nhập. Chưa đăng nhập -> AuthExpiredError để UI chuyển về /login.
function authHeaders(): Record<string, string> {
  const token = getSession()?.accessToken;
  if (!token) throw new AuthExpiredError("Vui lòng đăng nhập để tiếp tục.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// POST /api/parcels/calculate-fee (công khai) — backend trả { fee, currency, details }
export async function getQuote(req: QuoteRequest): Promise<QuoteResponse> {
  if (USE_MOCK) return mockGetQuote(req);
  const res = await fetch(`${API_BASE_URL}/api/parcels/calculate-fee`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toFeeRequest(req)),
  });
  if (!res.ok) throw await readError(res, "Không tính được phí ship, vui lòng thử lại.");
  return toQuoteResponse(req, (await res.json()) as { fee: number });
}

// POST /api/parcels (cần JWT) — senderId do backend lấy từ token, không gửi từ client
export async function createParcel(req: CreateParcelRequest): Promise<Parcel> {
  if (USE_MOCK) return mockCreateParcel(req);
  const res = await fetch(`${API_BASE_URL}/api/parcels`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(toCreateParcelDto(req)),
  });
  if (!res.ok) throw await readError(res, "Tạo đơn thất bại, vui lòng thử lại.");
  const created = fromBackendParcel((await res.json()) as BackendParcel, req.sender.fullName);
  // Backend chưa lưu thông tin người gửi / kiện hàng -> giữ lại dữ liệu khách vừa nhập cho màn hình thành công
  return { ...created, sender: req.sender, packageInfo: req.packageInfo, feeVnd: created.feeVnd || req.feeVnd };
}

// GET /api/public/track/:code (công khai). Trả null khi mã không tồn tại (404);
// ném Error có thông báo tiếng Việt khi API lỗi hoặc không kết nối được máy chủ.
export async function trackParcel(trackingCode: string): Promise<Parcel | null> {
  if (USE_MOCK) return mockTrackParcel(trackingCode);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/public/track/${encodeURIComponent(trackingCode)}`);
  } catch {
    throw new Error("Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng rồi thử lại.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, `Máy chủ trả lỗi (${res.status}) khi tra cứu đơn hàng.`);
  return toParcel((await res.json()) as PublicTrackResponse);
}

// Backend chỉ trả thông tin tối thiểu cho tra cứu công khai (không có SĐT, địa chỉ,
// thông tin người gửi) -> các trường còn lại của Parcel để rỗng, UI không dùng tới.
interface PublicTrackResponse {
  trackingCode: string;
  currentStatus: ParcelStatus;
  receiverName: string;
  history: ParcelEvent[];
  location?: ParcelLocationUpdate | null;
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
    location: r.location,
  };
}

// ---- Danh sách đơn của tôi ----
// GET /api/parcels/mine (cần JWT): backend lọc theo senderId lấy từ token.
export async function listMyParcels(): Promise<Parcel[]> {
  if (USE_MOCK) return mockListParcels();
  const res = await fetch(`${API_BASE_URL}/api/parcels/mine`, { headers: authHeaders() });
  if (!res.ok) throw await readError(res, "Không tải được danh sách đơn hàng.");
  const name = getSession()?.user.fullName ?? "";
  return ((await res.json()) as BackendParcel[]).map((p) => fromBackendParcel(p, name));
}

// ---- Real-time tracking: MỘT socket cho cả trạng thái lẫn vị trí tài xế ----
// Hợp đồng (backend/src/tracking/tracking.gateway.ts):
//   client -> server: `join:parcel` / `leave:parcel` { trackingCode } (ack { ok, error? })
//   server -> room  : `parcel.status.updated`, `parcel.delivery.completed` (bản vá trạng thái),
//                     `parcel.location.updated` { trackingCode, latitude, longitude, timestamp }
export type SyncResult = { ok: true; at: Date } | { ok: false; message: string };

export interface RealtimeHandlers {
  onParcel: (parcel: Parcel) => void;
  onLocation?: (loc: ParcelLocationUpdate | null) => void;
  onConnectionChange?: (connected: boolean) => void;
  // Kết quả mỗi lần đồng bộ snapshot REST (sau mỗi lần connect/reconnect)
  onSync?: (result: SyncResult) => void;
}

// `initial` là snapshot REST vừa lấy được; giữ làm bản nền để ghép các bản vá realtime vào.
// Trả về hàm cleanup (gọi khi unmount / đổi mã): gỡ mọi listener và đóng socket.
export function subscribeToParcelRealtime(
  trackingCode: string,
  initial: Parcel,
  handlers: RealtimeHandlers
): () => void {
  const { onParcel, onLocation, onConnectionChange, onSync } = handlers;
  let stopped = false;
  let latest: Parcel = initial;
  let locationRevision = 0;

  // Lấy lại snapshot REST. Gọi sau MỖI lần connect (kể cả lần đầu, để không hở khoảng giữa
  // snapshot ban đầu và lúc join room) nhằm bù event bị rớt lúc mất mạng.
  const resync = async () => {
    const revisionAtStart = locationRevision;
    try {
      const fresh = await trackParcel(trackingCode);
      if (stopped) return;
      if (fresh && isSnapshotFresh(fresh, latest)) {
        latest = fresh;
        onParcel(fresh);
        if (fresh.location !== undefined && revisionAtStart === locationRevision) {
          onLocation?.(fresh.location);
        }
      }
      onSync?.({ ok: true, at: new Date() });
    } catch (err) {
      if (!stopped) onSync?.({ ok: false, message: err instanceof Error ? err.message : "Không đồng bộ được dữ liệu." });
    }
  };

  const handleStatus = (update: ParcelStatusUpdate) => {
    if (stopped || update?.trackingCode !== trackingCode) return;
    // Payload không đúng dạng bản vá { currentStatus, event } -> không ghép bừa, tải lại snapshot REST
    if (!update.currentStatus || !update.event) {
      void resync();
      return;
    }
    latest = applyStatusUpdate(latest, update);
    onParcel(latest);
  };
  const handleLocation = (loc: ParcelLocationUpdate) => {
    if (stopped || loc.trackingCode !== trackingCode) return;
    locationRevision += 1;
    onLocation?.(loc);
  };

  if (USE_MOCK) {
    onConnectionChange?.(true);
    const leaveStatus = mockJoinRoom(trackingCode, handleStatus);
    const leaveLocation = mockJoinLocation(trackingCode, handleLocation);
    void resync();
    return () => {
      stopped = true;
      leaveStatus();
      leaveLocation();
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

  // Mỗi lần connect phải join lại room (server không nhớ room của socket cũ) rồi resync.
  // Các listener dưới đây được đăng ký đúng 1 lần cho socket này; reconnect của socket.io
  // dùng lại chính socket + listener nên không bị nhân đôi.
  socket.on("connect", () => {
    onConnectionChange?.(true);
    socket.emit("join:parcel", { trackingCode }, (ack?: { ok?: boolean; error?: string }) => {
      if (!stopped && ack?.ok === false) {
        onSync?.({ ok: false, message: `Máy chủ từ chối theo dõi đơn: ${ack.error ?? "không rõ lý do"}` });
      }
    });
    void resync();
  });
  socket.on("disconnect", () => onConnectionChange?.(false));
  socket.on("connect_error", () => onConnectionChange?.(false));
  socket.on("parcel.status.updated", handleStatus);
  socket.on("parcel.delivery.completed", handleStatus);
  socket.on("parcel.location.updated", handleLocation);

  return () => {
    stopped = true;
    if (socket.connected) socket.emit("leave:parcel", { trackingCode });
    socket.off(); // gỡ toàn bộ listener trước khi đóng
    socket.disconnect();
  };
}

export type { ParcelStatus };
