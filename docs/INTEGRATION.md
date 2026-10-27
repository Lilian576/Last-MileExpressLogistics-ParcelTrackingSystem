# Giao tiếp M3 → M2 sau transition

Contract TypeScript: [transition-notifier.ts](../backend/src/state-machine/transition-notifier.ts).

```ts
interface TransitionNotifier {
  onTransition(event: CommittedParcelTransition): Promise<void>;
}
// event: { eventId, parcelId, trackingCode, from, to, trigger,
//          occurredAt, locationId? }
```

M2 triển khai notifier và gọi `await notifier.onTransition(event)` **sau khi transaction DB commit thành công**, không gọi từ assertTransition. `eventId` lấy từ bản ghi history đã lưu, occurredAt là timestamp ISO 8601 của bản ghi đó. from=null khi tạo đơn. Không phát nếu validate thất bại, update thất bại hoặc transaction rollback.

Luồng yêu cầu: đọc parcel → assertTransition(from, trigger, actor, trustedContext) → transaction cập nhật status có kiểm tra trạng thái cũ, insert history và xử lý assignment → commit → onTransition. trustedContext phải lấy từ DB/bằng chứng đã kiểm tra, không tin các boolean guard do client gửi.

M2 emit vào room `parcel:<trackingCode>` khi client gửi `join:parcel` với `{ trackingCode }`. Tên event `parcel.status.updated`; nếu to=DELIVERED, thêm `parcel.delivery.completed`. Public payload: `{ eventId, trackingCode, status, updatedAt }`, trong đó status ánh xạ theo bảng đầu m3.md; không phát raw internal status, thông tin cá nhân hoặc lý do thất lạc. M1 cần điều chỉnh adapter nếu payload UI hiện tại khác. Deduplicate theo eventId; sau reconnect client tải lại snapshot/timeline để bù event bị lỡ.

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
