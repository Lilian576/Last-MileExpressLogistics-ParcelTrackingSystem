# Giao tiếp M3 → M2 sau transition

Contract TypeScript: [transition-notifier.ts](../backend/src/state-machine/transition-notifier.ts).

```ts
interface TransitionNotifier {
  onTransition(
    parcelId: string,
    from: ParcelStatus | null,
    to: ParcelStatus,
    actor: TransitionActor,
  ): Promise<void>;
}
```

M2 triển khai notifier và gọi `await notifier.onTransition(parcelId, from, to, actor)` **sau khi transaction DB commit thành công**, không gọi từ assertTransition. `parcelId` là UUID nội bộ, `from`/`to` là Prisma ParcelStatus; from=null khi tạo đơn. `actor` là vai trò TransitionActor (customer, shipper, dispatcher, warehouse_staff, system, admin), không phải userId; lấy từ danh tính đã xác thực, job dùng system. Không phát nếu validate thất bại, update thất bại hoặc transaction rollback.

Luồng yêu cầu: đọc parcel → assertTransition(from, trigger, actor, trustedContext) → transaction cập nhật status có kiểm tra trạng thái cũ, insert history và xử lý assignment → commit → onTransition. trustedContext phải lấy từ DB/bằng chứng đã kiểm tra, không tin các boolean guard do client gửi.

## Format WebSocket chốt cho gateway

Namespace mặc định `/`. Client gửi `join:parcel` với `{ "trackingCode": "PCL123" }` để vào room `parcel:PCL123`, gửi `leave:parcel` cùng payload để rời room. Chỉ join sau khi kiểm tra trackingCode hợp lệ/tồn tại. Sau reconnect client phải join lại và tải lại snapshot/timeline để bù cập nhật bị lỡ.

Gateway đọc snapshot parcel đã commit theo parcelId để lấy trackingCode, currentStatus và updatedAt. Event `parcel.status.updated` có payload đúng kiểu ParcelStatusUpdatedPayload trong file TypeScript:

```json
{
  "trackingCode": "PCL123",
  "status": "Received",
  "updatedAt": "2026-10-27T03:00:00.000Z"
}
```

updatedAt là timestamp ISO 8601 UTC từ DB, không phải thời điểm emit. status ánh xạ theo bảng đầu m3.md: CREATED/PENDING_PICKUP → Order Placed; PICKED_UP → Received; IN_TRANSIT/AT_HUB → In-Transit; OUT_FOR_DELIVERY/DELIVERY_FAILED → Out for Delivery; DELIVERED → Delivered; RETURNING → Being Returned; RETURNED → Returned; CANCELLED → Cancelled; LOST → Delayed. Không phát raw internal status, actor, thông tin cá nhân hoặc lý do thất lạc.

Khi tham số to=DELIVERED, emit thêm `parcel.delivery.completed` vào cùng room, cùng payload với status="Delivered" (ParcelDeliveryCompletedPayload). Gateway phải map từ snapshot nhất quán, không ghép status của một transition cũ với timestamp mới. Nếu nhiều transition commit sát nhau, snapshot có thể gộp các bước trung gian; lịch sử REST mới là nguồn đầy đủ. Contract 4 tham số này không cung cấp eventId/historyId để replay hoặc deduplicate chính xác từng transition.

**Lưu ý tích hợp M1:** Frontend hiện nhận nguyên object Parcel ở cả hai event. Payload chốt ở đây là thông báo snapshot nhỏ; M1 cần sửa handler để tải lại parcel/timeline qua REST, không truyền thẳng payload này vào onUpdate(Parcel). Không đổi REALTIME_MODE trước khi gateway và adapter cùng xong.

**Trạng thái triển khai:** file TypeScript mới là hợp đồng, chưa nối notifier vào ParcelsService và TrackingGateway hiện chỉ ping/pong. API updateStatus hiện chưa ghi history/transaction. M2 cần hoàn tất persistence trước khi nối hook. Lỗi emit sau commit không được báo như rollback; cần log và retry riêng. Nếu cần bảo đảm không mất event khi process chết giữa commit/emit, dùng transactional outbox và worker retry; hook trực tiếp chưa có bảo đảm đó.

## Rate limiting HTTP

RateLimitMiddleware được gắn toàn ứng dụng qua AppModule. Biến môi trường (số nguyên dương):

```dotenv
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
RATE_LIMIT_AUTH_MAX=10
```

Mọi HTTP route dùng chung quota theo IP; /auth/login và /auth/register dùng thêm quota auth chung (gồm cả request thành công/thất bại). OPTIONS không tính. Khi bị chặn trả 429 JSON, Retry-After (giây), X-RateLimit-Limit/Remaining/Reset (Reset là Unix timestamp giây). Quota reset sau cửa sổ tính từ request đầu tiên.

Không đọc X-Forwarded-For trực tiếp; mặc định Express không trust proxy. Nếu chạy sau reverse proxy, cấu hình trust proxy chỉ cho proxy tin cậy trước khi listen; nếu chưa cấu hình, các client sau proxy dùng chung IP/quota. Không bật trust proxy=true khi backend có thể nhận traffic trực tiếp. Store trong memory của mỗi process, dọn bucket hết hạn định kỳ; nhiều replica cần store chung. WebSocket không nằm trong HTTP limiter này, M2 phải xử lý riêng giới hạn message/subscribe.
