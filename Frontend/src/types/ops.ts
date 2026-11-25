import { ParcelStatus } from "./parcel";

// Role nội bộ dùng giao diện vận hành. Đúng enum Role ở backend/prisma/schema.prisma
// (customer | shipper | warehouse_staff | admin) — KHÔNG có role "dispatcher".
export type OpsRole = "admin" | "warehouse_staff";
export const OPS_ROLES: string[] = ["admin", "warehouse_staff"];
export const OPS_ROLE_LABEL: Record<OpsRole, string> = {
  admin: "Quản trị / điều phối",
  warehouse_staff: "Nhân viên kho",
};

export interface OpsSession {
  accessToken: string;
  user: { id: string; fullName: string; email: string; role: string };
}

// Đơn trả về từ GET /api/parcels (model Parcel của Prisma; Decimal -> string, Date -> ISO)
export interface OpsParcel {
  id: string;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: number | string;
  currentStatus: ParcelStatus;
  createdAt: string;
  senderLat: number | string | null;
  senderLng: number | string | null;
  currentLocationId: string | null;
  destinationLocationId: string | null;
}

// Kết quả PATCH /api/parcels/:id/assign-courier (ParcelsService.assignCourier)
export interface OpsHub {
  id: string;
  name: string;
  address: string;
}

export interface AssignCourierInput {
  destinationHubId: string;
  pickupLat?: number;
  pickupLng?: number;
}

export type OpsStatusUpdate =
  | { event: "arrive_at_hub"; hubId: string }
  | { event: "dispatch_to_next_hub" | "dispatch_last_mile" };

export interface AssignCourierResult {
  parcel: { id: string; currentStatus: ParcelStatus };
  assignmentResult: {
    found: boolean;
    reason?: string;
    courier?: { id: string; fullName: string };
    distanceKm?: number;
  };
}

// Thao tác vận hành theo trạng thái đơn. Mỗi dòng bám theo TRANSITION_TABLE
// (backend/src/state-machine/transition-table.ts): event, actor được phép và guard.
export type OpsAction = {
  id: string;
  label: string;
  roles: OpsRole[];
} & (
  | { kind: "assign" }
  | { kind: "status"; event: OpsStatusUpdate["event"]; confirm?: string }
);

export const OPS_ACTIONS: Partial<Record<ParcelStatus, OpsAction[]>> = {
  CREATED: [{ id: "assign", kind: "assign", label: "Gán tài xế gần nhất", roles: ["admin"] }],
  IN_TRANSIT: [
    {
      id: "arrive_at_hub",
      kind: "status",
      label: "Tiếp nhận tại hub",
      roles: ["warehouse_staff"],
      event: "arrive_at_hub",
      confirm: "Đã quét mã vận đơn tại hub",
    },
  ],
  AT_HUB: [
    {
      id: "dispatch_to_next_hub",
      kind: "status",
      label: "Chuyển sang hub tiếp theo",
      roles: ["warehouse_staff"],
      event: "dispatch_to_next_hub",
    },
    {
      id: "dispatch_last_mile",
      kind: "status",
      label: "Điều phối giao chặng cuối",
      roles: ["admin"],
      event: "dispatch_last_mile",
    },
  ],
};

// Trạng thái không có thao tác nào dành cho nhân viên vận hành -> lý do chờ
export const OPS_WAITING_NOTE: Partial<Record<ParcelStatus, string>> = {
  PENDING_PICKUP: "Đã gán tài xế — chờ tài xế lấy hàng",
  PICKED_UP: "Tài xế đã lấy hàng — chờ tài xế xuất phát về hub",
  OUT_FOR_DELIVERY: "Đang giao — chờ tài xế xác nhận kết quả",
  DELIVERY_FAILED: "Chờ hệ thống lên lịch giao lại",
  RETURNING: "Đang hoàn trả — chờ tài xế xác nhận",
};
