# Hợp đồng tích hợp cuối kỳ

Bản bàn giao M3 ngày 25/11/2026, đối chiếu main tại commit 8b61f25 và kế hoạch D01–D03. Tài liệu tách phần đang chạy với phần M2 cần tích hợp. OpenAPI nằm tại [openapi-spec.yaml](openapi-spec.yaml), bảng quyền tại [m3.md](m3.md).

## REST đang có trên main

| Method | Route | Hành vi hiện tại |
|---|---|---|
| POST | /auth/register | 201, luôn tạo customer, bỏ role do client gửi |
| POST | /auth/login | 200, trả accessToken và user |
| POST | /api/parcels/calculate-fee | Công khai, trả fee số nguyên VND, currency, details.weightKg |
| POST | /api/parcels | JWT, senderId lấy từ danh tính đăng nhập |
| GET | /api/parcels/mine | JWT, chỉ lấy senderId của người gọi |
| GET | /api/parcels/assigned/mine | JWT và role shipper |
| GET | /api/public/track/{code} | Công khai, mã không tồn tại trả 404 |
| GET | /api/parcels | Hiện thiếu guard. B02 phải giới hạn nhân sự |
| GET | /api/parcels/{id} | Hiện thiếu guard. B02 phải kiểm quyền sở hữu/assignment |
| PATCH | /api/parcels/{id}/status | JWT, nhận event; code hiện còn tin các cờ guard từ client |
| PATCH | /api/parcels/{id}/assign-courier | JWT, nhận pickupLat/pickupLng, assignment + status + history trong transaction |

Backend chưa có /quote. M1 đang dùng /calculate-fee. Các input và response dùng camelCase. Các giá trị Decimal trong response Prisma hiện được JSON hóa thành chuỗi. M1 chuyển số một lần trong adapter. Lỗi Nest thường có statusCode, message, error. 400 cho input/transition, 401 cho JWT/login, 403 cho role, 404 cho mã tracking, 409 cho duplicate hoặc transaction conflict, 429 cho quota.

## D01 dữ liệu phí, tọa độ và xác nhận giao

Migration 20261125000000_parcel_delivery_contract thêm vào Parcel các trường sau, tất cả nullable để giữ nguyên dữ liệu cũ.

| Prisma / JSON | PostgreSQL | Quy tắc bàn giao B01/F01 |
|---|---|---|
| feeVnd | fee_vnd INTEGER | Phí VND đã tính lúc tạo, số nguyên không âm |
| senderLat / senderLng | sender_lat / sender_lng NUMERIC(9,6) | Tọa độ lấy hàng, trong [-90,90] / [-180,180] |
| receiverLat / receiverLng | receiver_lat / receiver_lng NUMERIC(9,6) | Tọa độ đích, cùng giới hạn |
| deliveryProof | delivery_proof TEXT | Tham chiếu ảnh/chữ ký đã được backend kiểm tra, chỉ API nội bộ |
| deliveredAt | delivered_at TIMESTAMP(3) | UTC, do server ghi khi xác nhận giao thành công |

Tên feeVnd giữ theo frontend hiện có. B01 cần ghi bốn tọa độ và feeVnd trong create(), trả thêm fee để tương thích caller cũ nếu cần. Với parcel cũ có NULL, UI hiện “Chưa có dữ liệu”. Không thay NULL bằng 0 hoặc tính lại theo giá hiện tại. Thiếu tọa độ điều phối phải yêu cầu nhân sự bổ sung trước khi gán. Migration không thay đổi trạng thái, phí hoặc lịch sử của đơn cũ.

Xác nhận giao MVP đề xuất dùng event=confirm_delivery và deliveryProof là tham chiếu ảnh/chữ ký. B01 sở hữu DTO, kiểm tra tham chiếu, lưu deliveryProof/deliveredAt và history trong cùng transaction. hasDeliveryProof trong TransitionContext phải được server suy ra sau bước kiểm tra này. Checkbox hoặc boolean do client gửi không phải bằng chứng đã lưu. Schema mới chuẩn bị cột, API main chưa ghi các cột đó.

## Assignment và actor

Admin kiêm điều phối trong MVP. JWT role admin đi vào StateMachineService dưới actor admin, được assign_courier và dispatch_last_mile. Dispatcher là actor tương thích thiết kế cũ, không có tài khoản/Role Prisma. System chỉ dùng trong job của backend. Không nhận actor/role từ body.

| Chặng / thao tác | Side effect B01 cần commit cùng status/history |
|---|---|
| Gán pickup | Tạo pickup / assigned, chuyển PENDING_PICKUP |
| Xác nhận lấy | pickup → in_progress |
| Nhập hub | currentLocationId là hub thực, hoàn tất assignment chặng vừa đến |
| Điều phối hub tiếp theo | Tạo hub_transfer / assigned nếu có courier chặng đó |
| Điều phối chặng cuối | Tạo last_mile / assigned với tài xế rảnh, chuyển OUT_FOR_DELIVERY |
| Giao thành công | Hoàn tất last_mile, ghi completedAt và deliveredAt |
| Hủy trước lấy | Đóng các assignment đang hoạt động bằng cancelled |
| Giao thất bại | Tăng failedAttemptCount, lưu note, assignment failed |
| Giao lại / hoàn trả | B01 phải chốt việc nhận lại assignment hoặc tạo assignment mới trước nghiệm thu US-06/07 |

Không có enum return trong AssignmentType. Job retry/SLA, ticket khiếu nại và vận hành trả hàng đầy đủ còn phụ thuộc B01. Chỉ trạng thái assigned/accepted/in_progress giữ tài xế bận. Chưa có kiểm chứng các side effect này trên main ngoài gán pickup.

## Hook sau commit

Interface TypeScript tại backend/src/state-machine/transition-notifier.ts giữ chữ ký onTransition(parcelId, from, to, actor). M2 gọi sau transaction commit từ cả create, assign và updateStatus. StateMachineService chỉ validate, không phát sự kiện và không ghi DB.

Notifier phải đọc đúng history đã commit hoặc nhận snapshot nhất quán trong adapter M2. Không ghép trạng thái cũ với timestamp của lần đổi sau. Bản hook bốn tham số chưa mang historyId. Nếu cần phân biệt hai transition liên tiếp cùng trạng thái hoặc bảo đảm không mất event, M2 cần outbox/event ID gắn vào history khi commit.

Main hiện gọi TrackingGateway trực tiếp sau updateStatus. Gán ban đầu chưa emit và interface notifier chưa được cài đặt. B02 sở hữu việc nối điểm phát chung. Lỗi gửi sau commit cần được log/xử lý riêng, tránh trả thông báo như thể DB đã rollback.

## Socket.IO đang dùng

Namespace mặc định /. Room parcel:{trackingCode}. join:parcel và leave:parcel nhận {"trackingCode":"PCL123"}. Ack thành công là {"ok":true,"trackingCode":"PCL123"}. Main chỉ kiểm mã không rỗng và tối đa 64 ký tự, chưa kiểm mã có tồn tại. M1 tra REST trước, reconnect thì join lại và tải REST snapshot.

parcel.status.updated và parcel.delivery.completed dùng cùng dạng dữ liệu, khớp TrackingGateway và adapter M1.

```json
{
  "trackingCode": "PCL123",
  "currentStatus": "PICKED_UP",
  "event": {
    "status": "PICKED_UP",
    "timestamp": "2026-11-25T03:00:00.000Z"
  }
}
```

parcel.delivery.completed chỉ gửi khi currentStatus=DELIVERED. Socket hiện dùng enum nội bộ. Bảng nhãn public trong m3.md là quy tắc hiển thị đích, chưa phải payload wire đã triển khai. Không đổi payload thành {status, updatedAt} khi M1 chưa đổi adapter. Không thêm địa chỉ, điện thoại, bằng chứng giao hoặc danh tính actor vào event công khai.

driver:location nhận trackingCode, latitude, longitude, token. M1 hiện gửi token trong body và cả handshake auth.token. Main chưa dùng token, chưa kiểm assignment và chưa lưu GPS. B02 phải thống nhất cách xác thực, chặn NaN/Infinity, kiểm quyền tài xế và lưu vị trí mới nhất trước khi phát parcel.location.updated. Payload location gồm trackingCode, latitude, longitude, timestamp ISO UTC. Không có snapshot vị trí trong REST hiện tại, F02 cần B02 bổ sung trước khi khôi phục GPS sau reconnect.

## Webhook HTTP bàn giao B03

Đây là contract đề xuất, chưa có sender webhook trên main. OpenAPI 3.1 khai báo webhooks.parcelStatusUpdated, không khai báo URL callback giả như một route backend đang có.

- Đích do server cấu hình qua PARCEL_WEBHOOK_URL. Secret riêng qua PARCEL_WEBHOOK_SECRET. Timeout qua PARCEL_WEBHOOK_TIMEOUT_MS, đề xuất 5000 ms.
- POST JSON sau commit từ notifier. Body gồm eventId, type=parcel.status.updated, occurredAt và data có cùng dạng status socket.
- Header X-Webhook-Id trùng eventId, X-Webhook-Timestamp là Unix time giây. X-Webhook-Signature có dạng sha256=<hex>.
- Ký HMAC-SHA256 bằng secret trên chuỗi timestamp + "." + rawBody UTF-8. Receiver so sánh constant-time, kiểm thời gian lệch tối đa 300 giây và chống nhận lặp theo eventId.
- Receiver trả 2xx để xác nhận. Timeout/ngoài 2xx ghi lỗi gắn eventId, retry giữ nguyên eventId. Không đổi trạng thái parcel đã commit vì lỗi receiver.
- Chính sách retry và lưu hàng đợi bền vững cần M2 triển khai và M4 kiểm tra trước khi đánh dấu B03 đạt.

## Migration và seed demo

Chạy trong backend, cấu hình DATABASE_URL tới DB demo riêng, JWT_SECRET riêng, DEMO_SEED_PASSWORD tối thiểu 12 ký tự và tối đa 72 byte.

```powershell
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

| Email | Role | Dùng trong demo |
|---|---|---|
| customer@example.test | customer | Tạo đơn / xem đơn của mình |
| warehouse@example.test | warehouse_staff | Tiếp nhận và trung chuyển hub |
| admin@example.test | admin | Gán pickup, điều phối chặng cuối |
| shipper1@example.test | shipper | Lấy hàng / giao hàng, tọa độ Quận 7 |
| shipper2@example.test | shipper | Tài xế thứ hai, tọa độ Quận 1 |

Seed còn tạo demo-hub-q7 và demo-hub-q1. Các tài khoản có chung mật khẩu DEMO_SEED_PASSWORD lúc tạo. Upsert giữ nguyên tài khoản/hub đã có, không đổi mật khẩu hoặc vị trí đang dùng. Muốn đổi mật khẩu demo cần thao tác quản trị riêng. Seed không tạo đơn giả và không xóa dữ liệu người dùng. Trước deploy dữ liệu từ bản đăng ký cũ cần rà soát tài khoản quyền cao từng được tạo qua public register.

## Rate limiting và giới hạn triển khai

RateLimitMiddleware áp dụng mọi HTTP route, mặc định RATE_LIMIT_WINDOW_MS=60000, RATE_LIMIT_MAX=120 và RATE_LIMIT_AUTH_MAX=10. Login/register cộng chung quota auth kể cả request lỗi. OPTIONS không tính, 429 có Retry-After và X-RateLimit-Limit/Remaining/Reset. Không tự tin X-Forwarded-For. Nếu có reverse proxy, M2 cấu hình trust proxy theo địa chỉ proxy tin cậy.

Quota nằm trong bộ nhớ một process, không dùng chung nhiều replica. HTTP limiter chưa giới hạn Socket.IO. JWT secret phải được cấu hình, register luôn là customer. Việc kiểm quyền đối tượng ở GET và GPS là khoảng trống B02 còn mở.
