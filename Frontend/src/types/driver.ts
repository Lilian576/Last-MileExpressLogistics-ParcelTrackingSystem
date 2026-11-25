import { ParcelStatus } from "./parcel";

export interface DriverUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export interface DriverSession {
  accessToken: string;
  user: DriverUser;
}

// Đơn trong danh sách của tài xế — field khớp model Parcel của backend
// (GET /api/parcels/assigned/mine). weightKg là Decimal nên JSON ra dạng string.
export interface DriverParcel {
  id: string;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: number | string;
  currentStatus: ParcelStatus;
}

// Tên event gửi lên PATCH /api/parcels/:id/status — đúng TransitionEvent ở
// backend/src/state-machine/state-machine.types.ts
export type ShipperEvent =
  | "confirm_pickup"
  | "depart_to_hub"
  | "confirm_delivery"
  | "report_failed_delivery"
  | "confirm_return_to_sender";

export interface ShipperAction {
  event: ShipperEvent;
  to: ParcelStatus;
  label: string;
  tone: "primary" | "danger";
  // Guard của state machine mà UI phải xác nhận với tài xế trước khi gửi
  needsProof?: boolean;
}

// Những transition mà actor 'shipper' ĐƯỢC PHÉP làm — rút từ TRANSITION_TABLE
// (allowedActors có 'shipper'). Các bước còn lại do kho/điều phối/hệ thống làm.
export const SHIPPER_ACTIONS: Partial<Record<ParcelStatus, ShipperAction[]>> = {
  PENDING_PICKUP: [{ event: "confirm_pickup", to: "PICKED_UP", label: "Đã lấy hàng", tone: "primary" }],
  PICKED_UP: [{ event: "depart_to_hub", to: "IN_TRANSIT", label: "Xuất phát về hub", tone: "primary" }],
  OUT_FOR_DELIVERY: [
    { event: "confirm_delivery", to: "DELIVERED", label: "Giao thành công", tone: "primary", needsProof: true },
    { event: "report_failed_delivery", to: "DELIVERY_FAILED", label: "Giao thất bại", tone: "danger" },
  ],
  RETURNING: [
    { event: "confirm_return_to_sender", to: "RETURNED", label: "Đã trả về người gửi", tone: "primary" },
  ],
};

// Trạng thái mà tài xế chưa phải làm gì — hiển thị lý do chờ
export const WAITING_NOTE: Partial<Record<ParcelStatus, string>> = {
  IN_TRANSIT: "Đang trung chuyển — chờ nhân viên kho quét tại hub",
  AT_HUB: "Đang ở hub — chờ điều phối giao chặng cuối",
  DELIVERY_FAILED: "Chờ hệ thống lên lịch giao lại",
};
