import {
  Parcel,
  ParcelStatus,
  ParcelStatusUpdate,
  ParcelLocationUpdate,
  TERMINAL_STATUSES,
  isValidTransition,
  QuoteRequest,
  QuoteResponse,
  CreateParcelRequest,
} from "../types/parcel";
import { DriverParcel, DriverSession, SHIPPER_ACTIONS, ShipperEvent } from "../types/driver";
import { AuthExpiredError } from "./errors";
import { AuthSession, RegisterRequest } from "../types/auth";
import { addMyTrackingCode, getMyTrackingCodes } from "../lib/myOrders";

// ---- "Database" giả lập ----
// Lưu trong localStorage (+ bản dự phòng trong bộ nhớ nếu localStorage bị chặn) để
// 2 tab cùng trình duyệt dùng chung dữ liệu: 1 tab đóng vai tài xế, 1 tab là
// trang tracking — đúng kịch bản demo "2 màn hình song song" của Tuần 4.
const STORE_KEY = "lemail.mock.parcels.v1";
type Store = Record<string, Parcel>;
let memoryStore: Store = {};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    return memoryStore;
  }
  return memoryStore;
}

function saveStore(store: Store) {
  memoryStore = store;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage bị chặn: vẫn chạy được trong 1 tab nhờ memoryStore
  }
}

function getParcel(trackingCode: string): Parcel | undefined {
  return loadStore()[trackingCode];
}

function putParcel(parcel: Parcel) {
  const store = loadStore();
  store[parcel.trackingCode] = parcel;
  saveStore(store);
}

// ---- Pub/sub giả lập kênh WebSocket (thay cho socket.io server thật) ----
// Phát trong tab hiện tại + BroadcastChannel sang các tab khác.
type StatusListener = (update: ParcelStatusUpdate) => void;
type LocationListener = (loc: ParcelLocationUpdate) => void;
const listenersByCode = new Map<string, Set<StatusListener>>();
const locationListenersByCode = new Map<string, Set<LocationListener>>();

type ChannelMessage =
  | { kind: "status"; update: ParcelStatusUpdate }
  | { kind: "location"; loc: ParcelLocationUpdate };

function dispatchLocal(msg: ChannelMessage) {
  if (msg.kind === "status") {
    listenersByCode.get(msg.update.trackingCode)?.forEach((cb) => cb(structuredClone(msg.update)));
  } else {
    locationListenersByCode.get(msg.loc.trackingCode)?.forEach((cb) => cb({ ...msg.loc }));
  }
}

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("lemail-mock") : null;
if (channel) {
  channel.onmessage = (e: MessageEvent<ChannelMessage>) => dispatchLocal(e.data);
}

function emit(msg: ChannelMessage) {
  dispatchLocal(msg);
  channel?.postMessage(msg);
}

function emitUpdate(update: ParcelStatusUpdate) {
  emit({ kind: "status", update });
}

// Mock của socket `driver:location` -> server phát `parcel.location.updated`
export function mockEmitLocation(trackingCode: string, latitude: number, longitude: number) {
  emit({ kind: "location", loc: { trackingCode, latitude, longitude, timestamp: new Date().toISOString() } });
}

export function mockJoinLocation(trackingCode: string, cb: LocationListener): () => void {
  if (!locationListenersByCode.has(trackingCode)) locationListenersByCode.set(trackingCode, new Set());
  locationListenersByCode.get(trackingCode)!.add(cb);
  return () => locationListenersByCode.get(trackingCode)?.delete(cb);
}

// Đổi trạng thái + ghi lịch sử + phát event (dùng chung cho tài xế và nút demo)
function applyTransition(parcel: Parcel, to: ParcelStatus) {
  const event = { status: to, timestamp: new Date().toISOString() };
  parcel.currentStatus = to;
  parcel.history.push(event);
  putParcel(parcel);
  emitUpdate({ trackingCode: parcel.trackingCode, currentStatus: to, event });
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
  putParcel(parcel);
  addMyTrackingCode(trackingCode); // mock không có tài khoản thật -> nhớ đơn theo trình duyệt
  if (MOCK_AUTO_PROGRESS) scheduleAutoProgress(trackingCode);
  return structuredClone(parcel);
}

// ---- Lấy snapshot hiện tại (mock GET /api/public/track/:code) ----
export async function mockTrackParcel(trackingCode: string): Promise<Parcel | null> {
  await delay(400);
  const p = getParcel(trackingCode);
  return p ? structuredClone(p) : null;
}

// ---- Danh sách đơn của tôi (mock GET /api/parcels/mine) ----
// Backend thật lọc theo userId trong JWT; mock chỉ nhớ mã đơn theo trình duyệt.
export async function mockListParcels(): Promise<Parcel[]> {
  await delay(450);
  const trackingCodes = getMyTrackingCodes();
  const found = trackingCodes
    .map((code) => getParcel(code))
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
export function mockJoinRoom(trackingCode: string, cb: StatusListener): () => void {
  if (!listenersByCode.has(trackingCode)) listenersByCode.set(trackingCode, new Set());
  listenersByCode.get(trackingCode)!.add(cb);
  return () => listenersByCode.get(trackingCode)?.delete(cb);
}

// ---- Giả lập tự động đẩy trạng thái (chỉ để demo khách hàng KHI KHÔNG có tài xế) ----
// Tắt mặc định từ khi có Driver UI: nếu bật, đơn tự chạy tới DELIVERED và tài xế
// không còn gì để bấm. Đổi thành true nếu muốn demo nhanh chỉ với màn hình khách.
export const MOCK_AUTO_PROGRESS = false;

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
    const parcel = getParcel(trackingCode);
    if (!parcel || i >= sequence.length) return;
    const next = sequence[i];
    if (!isValidTransition(parcel.currentStatus, next)) return; // an toàn: tôn trọng state machine
    applyTransition(parcel, next);
    i += 1;
    if (i < sequence.length) setTimeout(tick, 3500);
  };
  setTimeout(tick, 3500);
}

// ---- Nút demo trên trang tracking (đóng vai kho/điều phối) ----
export function mockForceTransition(trackingCode: string, to: ParcelStatus) {
  const parcel = getParcel(trackingCode);
  if (!parcel) return;
  if (!isValidTransition(parcel.currentStatus, to)) {
    console.warn(`Transition không hợp lệ: ${parcel.currentStatus} -> ${to}`);
    return;
  }
  applyTransition(parcel, to);
}

// ================================================================
// Driver (tài xế) — mock cho POST /auth/login, GET /api/parcels/assigned/mine,
// PATCH /api/parcels/:id/status
// ================================================================
export const MOCK_DRIVER = {
  email: "driver@demo.vn",
  password: "123456",
  token: "mock-driver-token",
  user: { id: "mock-driver-1", fullName: "Nguyễn Văn Tài", email: "driver@demo.vn", role: "shipper" },
};

export async function mockDriverLogin(email: string, password: string): Promise<DriverSession> {
  await delay(400);
  if (email.trim().toLowerCase() !== MOCK_DRIVER.email || password !== MOCK_DRIVER.password) {
    throw new Error("Email hoặc mật khẩu không đúng");
  }
  return { accessToken: MOCK_DRIVER.token, user: { ...MOCK_DRIVER.user } };
}

// ---- Khách hàng (mock POST /auth/register, /auth/login) ----
const CUSTOMERS_KEY = "lemail.mock.customers.v1";
interface MockCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

function loadCustomers(): MockCustomer[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMERS_KEY) ?? "[]") as MockCustomer[];
  } catch {
    return [];
  }
}

function toCustomerSession(c: MockCustomer): AuthSession {
  return {
    accessToken: `mock-customer-${c.id}`,
    user: { id: c.id, fullName: c.fullName, email: c.email, role: "customer" },
  };
}

export async function mockCustomerRegister(req: RegisterRequest): Promise<AuthSession> {
  await delay(400);
  const list = loadCustomers();
  const email = req.email.trim().toLowerCase();
  if (list.some((c) => c.email === email || c.phone === req.phone)) {
    throw new Error("email hoặc phone đã được sử dụng");
  }
  const c: MockCustomer = { id: `c${Date.now()}`, fullName: req.fullName, email, phone: req.phone, password: req.password };
  try {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([...list, c]));
  } catch {
    // localStorage bị chặn: tài khoản mock không được lưu
  }
  return toCustomerSession(c);
}

export async function mockCustomerLogin(email: string, password: string): Promise<AuthSession> {
  await delay(400);
  const c = loadCustomers().find((x) => x.email === email.trim().toLowerCase() && x.password === password);
  if (!c) throw new Error("Email hoặc mật khẩu không đúng");
  return toCustomerSession(c);
}

function assertMockToken(token: string) {
  if (token !== MOCK_DRIVER.token) throw new AuthExpiredError();
}

// Mock coi mọi đơn đã qua bước "gán tài xế" (PENDING_PICKUP trở đi) và chưa kết
// thúc là đơn được giao cho tài xế demo. Bước CREATED -> PENDING_PICKUP (điều phối
// gán tài xế) làm bằng nút demo trên trang tracking.
export async function mockListAssigned(token: string): Promise<DriverParcel[]> {
  await delay(350);
  assertMockToken(token);
  return Object.values(loadStore())
    .filter((p) => p.currentStatus !== "CREATED" && !TERMINAL_STATUSES.includes(p.currentStatus))
    .sort((a, b) => (b.history[0]?.timestamp ?? "").localeCompare(a.history[0]?.timestamp ?? ""))
    .map((p) => ({
      id: p.trackingCode,
      trackingCode: p.trackingCode,
      receiverName: p.receiver.fullName,
      receiverPhone: p.receiver.phone,
      receiverAddress: `${p.receiver.addressLine}, ${p.receiver.province}`,
      weightKg: p.packageInfo.weightKg,
      currentStatus: p.currentStatus,
    }));
}

// Áp đúng luật của backend: chỉ event dành cho shipper, đúng trạng thái hiện tại,
// và guard (hasDeliveryProof) phải thỏa.
export async function mockDriverUpdateStatus(
  token: string,
  id: string,
  event: ShipperEvent,
  context: { hasDeliveryProof?: boolean }
): Promise<{ currentStatus: ParcelStatus }> {
  await delay(300);
  assertMockToken(token);
  const parcel = getParcel(id);
  if (!parcel) throw new Error(`Không tìm thấy đơn hàng với id ${id}`);
  const action = SHIPPER_ACTIONS[parcel.currentStatus]?.find((a) => a.event === event);
  if (!action) {
    throw new Error(`Không tồn tại transition từ trạng thái '${parcel.currentStatus}' với event '${event}'`);
  }
  if (action.needsProof && context.hasDeliveryProof !== true) {
    throw new Error("Điều kiện không thỏa mãn: Có bằng chứng giao (ảnh/chữ ký)");
  }
  applyTransition(parcel, action.to);
  return { currentStatus: action.to };
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
