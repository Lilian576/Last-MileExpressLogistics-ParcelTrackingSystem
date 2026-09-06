// Trạng thái đơn hàng — PHẢI khớp 100% với state machine bên backend (ParcelModule)
export type ParcelStatus =
  | "CREATED"
  | "PICKED_UP"
  | "AT_SORTING_CENTER"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_DELIVERY"
  | "RESCHEDULED"
  | "RETURNED";

// Nhãn hiển thị tiếng Việt cho UI
export const STATUS_LABEL: Record<ParcelStatus, string> = {
  CREATED: "Đã tạo đơn",
  PICKED_UP: "Đã lấy hàng",
  AT_SORTING_CENTER: "Tại trung tâm phân loại",
  IN_TRANSIT: "Đang trung chuyển",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  DELIVERED: "Đã giao thành công",
  FAILED_DELIVERY: "Giao hàng thất bại",
  RESCHEDULED: "Đã lên lịch giao lại",
  RETURNED: "Đã hoàn trả",
};

// Bảng transition hợp lệ (đối chiếu với mô tả backend: state machine, không cho nhảy bước)
export const VALID_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  CREATED: ["PICKED_UP"],
  PICKED_UP: ["AT_SORTING_CENTER"],
  AT_SORTING_CENTER: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
  FAILED_DELIVERY: ["RESCHEDULED", "RETURNED"],
  RESCHEDULED: ["OUT_FOR_DELIVERY"],
  DELIVERED: [],
  RETURNED: [],
};

// Chuỗi "happy path" chính — dùng để vẽ timeline dọc (các trạng thái rẽ nhánh
// FAILED_DELIVERY/RESCHEDULED/RETURNED được vẽ riêng như một nhánh phụ)
export const MAIN_TIMELINE: ParcelStatus[] = [
  "CREATED",
  "PICKED_UP",
  "AT_SORTING_CENTER",
  "IN_TRANSIT",
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
