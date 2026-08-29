import { ParcelStatus } from '@prisma/client';

// Danh sách event/trigger — đúng theo cột "Event / Trigger" trong transition table (m3.md mục 2.2)
export enum TransitionEvent {
  CREATE_PARCEL = 'create_parcel',
  ASSIGN_COURIER = 'assign_courier',
  CANCEL_ORDER = 'cancel_order',
  CONFIRM_PICKUP = 'confirm_pickup',
  DEPART_TO_HUB = 'depart_to_hub',
  ARRIVE_AT_HUB = 'arrive_at_hub',
  DISPATCH_TO_NEXT_HUB = 'dispatch_to_next_hub',
  DISPATCH_LAST_MILE = 'dispatch_last_mile',
  SLA_TIMEOUT = 'sla_timeout',
  CONFIRM_DELIVERY = 'confirm_delivery',
  REPORT_FAILED_DELIVERY = 'report_failed_delivery',
  RETRY_DELIVERY = 'retry_delivery',
  MAX_RETRIES_REACHED = 'max_retries_reached',
  CONFIRM_RETURN_TO_SENDER = 'confirm_return_to_sender',
}

// Actor — đúng theo cột "Actor" trong transition table
export type TransitionActor = 'customer' | 'shipper' | 'dispatcher' | 'warehouse_staff' | 'system' | 'admin';

/**
 * Ngữ cảnh (context) mà bên gọi (M2 - ParcelsService) phải cung cấp
 * để StateMachineService kiểm tra điều kiện (Guard) của từng transition.
 * Tất cả field đều optional vì mỗi transition chỉ cần một vài field liên quan.
 */
export interface TransitionContext {
  /** Có shipper khả dụng gần điểm lấy hàng không (dùng cho assign_courier) */
  hasAvailableCourier?: boolean;
  /** Shipper thực hiện có đúng là người được assign cho parcel này không */
  isAssignedCourier?: boolean;
  /** Location vừa quét có phải loại 'hub' không (dùng cho arrive_at_hub) */
  isHubLocation?: boolean;
  /** Hub hiện tại có phải hub phụ trách khu vực giao hàng cuối không */
  isFinalHub?: boolean;
  /** Số giờ kể từ lần cập nhật trạng thái gần nhất (dùng cho sla_timeout) */
  hoursSinceLastUpdate?: number;
  /** Có bằng chứng giao hàng (ảnh/chữ ký) không (dùng cho confirm_delivery) */
  hasDeliveryProof?: boolean;
  /** Số lần giao thất bại hiện tại của parcel (failed_attempt_count) */
  failedAttemptCount?: number;
  /** Ngưỡng tối đa số lần thử lại, mặc định 3 nếu không truyền */
  maxRetryAttempts?: number;
}

export interface TransitionDefinition {
  id: number;
  from: ParcelStatus | null; // null nghĩa là trạng thái khởi tạo (chưa có parcel)
  to: ParcelStatus;
  event: TransitionEvent;
  allowedActors: TransitionActor[];
  /** Mô tả điều kiện guard, dùng để trả về thông báo lỗi rõ ràng */
  guardDescription: string;
  sideEffect: string;
  /** Hàm kiểm tra guard thật sự, trả về true nếu điều kiện thỏa mãn */
  guard: (ctx: TransitionContext) => boolean;
}

export interface TransitionResult {
  valid: boolean;
  toStatus?: ParcelStatus;
  matchedTransition?: TransitionDefinition;
  reason?: string;
}
