// Trạng thái đơn hàng — copy chính xác từ enum ParcelStatus trong
// backend/prisma/schema.prisma (M3), đối chiếu với
// backend/src/state-machine/transition-table.ts (12 trạng thái đầy đủ,
// bao gồm cả các nhánh lỗi/hủy/thất lạc).
export type ParcelStatus =
  | "CREATED"
  | "PENDING_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "AT_HUB"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURNING"
  | "RETURNED"
  | "CANCELLED"
  | "LOST";

// Nhãn hiển thị tiếng Việt cho UI
export const STATUS_LABEL: Record<ParcelStatus, string> = {
  CREATED: "Đã tạo đơn",
  PENDING_PICKUP: "Chờ lấy hàng",
  PICKED_UP: "Đã lấy hàng",
  IN_TRANSIT: "Đang trung chuyển",
  AT_HUB: "Tại trung tâm phân loại",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  DELIVERED: "Đã giao thành công",
  DELIVERY_FAILED: "Giao hàng thất bại",
  RETURNING: "Đang hoàn trả",
  RETURNED: "Đã hoàn trả",
  CANCELLED: "Đã hủy đơn",
  LOST: "Thất lạc",
};

// Bảng transition hợp lệ — rút gọn từ TRANSITION_TABLE thật (bỏ actor/guard/
// event vì frontend chỉ cần biết "từ trạng thái này có thể đi tới đâu" để vẽ
// UI, không tự validate nghiệp vụ — việc đó StateMachineService (M3) lo).
export const VALID_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  CREATED: ["PENDING_PICKUP", "CANCELLED"],
  PENDING_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["AT_HUB", "LOST"],
  AT_HUB: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "LOST"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNING"],
  RETURNING: ["RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
  LOST: [],
};

// Trạng thái cuối (terminal) — copy từ TERMINAL_STATES trong transition-table.ts
export const TERMINAL_STATUSES: ParcelStatus[] = ["DELIVERED", "RETURNED", "CANCELLED", "LOST"];

// Chuỗi "happy path" chính — dùng để vẽ timeline dọc (các nhánh
// DELIVERY_FAILED/RETURNING/RETURNED/CANCELLED/LOST vẽ riêng như nhánh phụ)
export const MAIN_TIMELINE: ParcelStatus[] = [
  "CREATED",
  "PENDING_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export function isValidTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface Address {
  fullName: string;
  phone: string;
  addressLine: string;
  province: string;
}

export interface PackageInfo {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  category: "DOCUMENT" | "CLOTHING" | "ELECTRONICS" | "FOOD" | "OTHER";
  note?: string;
}

export interface QuoteRequest {
  sender: Address;
  receiver: Address;
  packageInfo: PackageInfo;
}

export interface QuoteResponse {
  feeVnd: number;
  estimatedDays: number;
  breakdown: { label: string; amountVnd: number }[];
}

export interface CreateParcelRequest extends QuoteRequest {
  feeVnd: number;
}

export interface ParcelEvent {
  status: ParcelStatus;
  timestamp: string; // ISO string
  note?: string;
}

export interface Parcel {
  trackingCode: string;
  sender: Address;
  receiver: Address;
  packageInfo: PackageInfo;
  feeVnd: number;
  currentStatus: ParcelStatus;
  history: ParcelEvent[];
}
