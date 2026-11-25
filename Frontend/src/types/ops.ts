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
}

// Kết quả PATCH /api/parcels/:id/assign-courier (ParcelsService.assignCourier)
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
export interface OpsAction {
  id: string;
  kind: "assign" | "status";
  label: string;
  // Role (JWT) được phép — actor trong bảng chuyển trạng thái
  roles: OpsRole[];
  event?: string;
  // Context guard gửi kèm PATCH /status (đúng giá trị guard yêu cầu)
  context?: Record<string, boolean>;
  // Guard cần nhân viên xác nhận trước khi gửi
  confirm?: string;
  // Nếu có lý do => nút bị khóa và hiển thị lý do (dùng khi một thao tác chưa thực hiện được)
  blocked?: string;
}

export const OPS_ACTIONS: Partial<Record<ParcelStatus, OpsAction[]>> = {
  // Dòng 2: CREATED -> PENDING_PICKUP, actor dispatcher/system/admin; DTO bắt buộc pickupLat/pickupLng
  CREATED: [{ id: "assign", kind: "assign", label: "Gán tài xế gần nhất", roles: ["admin"] }],
  // Dòng 7: IN_TRANSIT -> AT_HUB, actor warehouse_staff, guard isHubLocation = true
  IN_TRANSIT: [
    {
      id: "arrive_at_hub",
      kind: "status",
      label: "Tiếp nhận tại hub",
      roles: ["warehouse_staff"],
      event: "arrive_at_hub",
      context: { isHubLocation: true },
      confirm: "Đã quét mã vận đơn tại hub",
    },
  ],
  AT_HUB: [
    // Dòng 9: AT_HUB -> IN_TRANSIT, actor warehouse_staff, guard isFinalHub = false
    {
      id: "dispatch_to_next_hub",
      kind: "status",
      label: "Chuyển sang hub tiếp theo",
      roles: ["warehouse_staff"],
      event: "dispatch_to_next_hub",
      context: { isFinalHub: false },
    },
    // Dòng 10: AT_HUB -> OUT_FOR_DELIVERY. Kế hoạch D01 chốt `admin` kiêm điều phối trong MVP.
    // LƯU Ý: transition-table.ts trên main/develop vẫn chỉ cho actor 'dispatcher' => backend trả 403
    // cho tới khi M3 thêm 'admin' vào allowedActors của DISPATCH_LAST_MILE (UI hiển thị nguyên văn lỗi).
    {
      id: "dispatch_last_mile",
      kind: "status",
      label: "Điều phối giao chặng cuối",
      roles: ["admin"],
      event: "dispatch_last_mile",
      context: { isFinalHub: true },
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
