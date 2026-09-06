import {
  Parcel,
  ParcelStatus,
  isValidTransition,
  QuoteRequest,
  QuoteResponse,
  CreateParcelRequest,
} from "../types/parcel";

// ---- "Database" giả lập trong bộ nhớ (chỉ tồn tại trong phiên làm việc) ----
const store = new Map<string, Parcel>();

// ---- Pub/sub giả lập kênh WebSocket (thay cho socket.io server thật) ----
type Listener = (parcel: Parcel) => void;
const listenersByCode = new Map<string, Set<Listener>>();

function emitUpdate(parcel: Parcel) {
  const listeners = listenersByCode.get(parcel.trackingCode);
  listeners?.forEach((cb) => cb(structuredClone(parcel)));
}

function genTrackingCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 90000 + 10000);
  return `LM${y}${m}${d}${rand}`;
}

// ---- Tính phí ship (mock pricing engine) ----
export async function mockGetQuote(req: QuoteRequest): Promise<QuoteResponse> {
  await delay(500);
  const { weightKg, lengthCm, widthCm, heightCm } = req.packageInfo;
  const volumetric = (lengthCm * widthCm * heightCm) / 5000;
  const chargeableWeight = Math.max(weightKg, volumetric);
  const base = 15000;
  const perKg = 8000;
  const isInterProvince = req.sender.province !== req.receiver.province;
  const distanceFee = isInterProvince ? 20000 : 5000;
  const weightFee = Math.round(chargeableWeight * perKg);
  const feeVnd = base + weightFee + distanceFee;
  return {
    feeVnd,
    estimatedDays: isInterProvince ? 3 : 1,
    breakdown: [
      { label: "Phí cơ bản", amountVnd: base },
      { label: `Phí trọng lượng (${chargeableWeight.toFixed(1)}kg quy đổi)`, amountVnd: weightFee },
      { label: isInterProvince ? "Phí liên tỉnh" : "Phí nội tỉnh", amountVnd: distanceFee },
    ],
  };
}

// ---- Tạo đơn (mock POST /api/parcels) ----
export async function mockCreateParcel(req: CreateParcelRequest): Promise<Parcel> {
  await delay(600);
  const trackingCode = genTrackingCode();
  const parcel: Parcel = {
    trackingCode,
    sender: req.sender,
    receiver: req.receiver,
    packageInfo: req.packageInfo,
    feeVnd: req.feeVnd,
    currentStatus: "CREATED",
    history: [{ status: "CREATED", timestamp: new Date().toISOString() }],
  };
  store.set(trackingCode, parcel);
  scheduleAutoProgress(trackingCode);
  return structuredClone(parcel);
}

// ---- Lấy snapshot hiện tại (mock GET /api/public/track/:code) ----
export async function mockTrackParcel(trackingCode: string): Promise<Parcel | null> {
  await delay(400);
  const p = store.get(trackingCode);
  return p ? structuredClone(p) : null;
}

// ---- Lấy danh sách nhiều đơn theo mã (mock GET /api/parcels/mine) ----
// Backend thật sẽ lấy theo userId từ JWT thay vì nhận list code từ client.
export async function mockListParcels(trackingCodes: string[]): Promise<Parcel[]> {
  await delay(450);
  const found = trackingCodes
    .map((code) => store.get(code))
    .filter((p): p is Parcel => Boolean(p))
    .map((p) => structuredClone(p));
  // Mới tạo trước hiển thị trước
  found.sort((a, b) => {
    const ta = a.history[0]?.timestamp ?? "";
    const tb = b.history[0]?.timestamp ?? "";
    return tb.localeCompare(ta);
  });
  return found;
}

// ---- Join room theo trackingCode (mock socket "join:parcel") ----
export function mockJoinRoom(trackingCode: string, cb: Listener): () => void {
  if (!listenersByCode.has(trackingCode)) listenersByCode.set(trackingCode, new Set());
  listenersByCode.get(trackingCode)!.add(cb);
  return () => listenersByCode.get(trackingCode)?.delete(cb);
}

// ---- Giả lập tài xế/hệ thống tự động đẩy trạng thái tiếp theo mỗi vài giây ----
// Mục đích: cho phép bạn test UI real-time mà không cần chờ backend thật.
function scheduleAutoProgress(trackingCode: string) {
  const sequence: ParcelStatus[] = [
    "PENDING_PICKUP",
    "PICKED_UP",
    "IN_TRANSIT",
    "AT_HUB",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  let i = 0;
  const tick = () => {
    const parcel = store.get(trackingCode);
    if (!parcel || i >= sequence.length) return;
    const next = sequence[i];
    if (!isValidTransition(parcel.currentStatus, next)) return; // an toàn: tôn trọng state machine
    parcel.currentStatus = next;
    parcel.history.push({ status: next, timestamp: new Date().toISOString() });
    store.set(trackingCode, parcel);
    emitUpdate(parcel);
    i += 1;
    if (i < sequence.length) setTimeout(tick, 3500);
  };
  setTimeout(tick, 3500);
}

// ---- Cho phép thao tác thủ công từ UI demo (VD: nút "Giả lập giao thất bại") ----
export function mockForceTransition(trackingCode: string, to: ParcelStatus) {
  const parcel = store.get(trackingCode);
  if (!parcel) return;
  if (!isValidTransition(parcel.currentStatus, to)) {
    console.warn(`Transition không hợp lệ: ${parcel.currentStatus} -> ${to}`);
    return;
  }
  parcel.currentStatus = to;
  parcel.history.push({ status: to, timestamp: new Date().toISOString() });
  store.set(trackingCode, parcel);
  emitUpdate(parcel);
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
