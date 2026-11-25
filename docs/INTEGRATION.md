# Hợp đồng tích hợp cuối kỳ

Đối chiếu develop a230451 ngày 25/11/2026 sau PR #34. OpenAPI tại [openapi-spec.yaml](openapi-spec.yaml). Payload bên dưới lấy từ DTO, ParcelsService, TrackingGateway và ParcelNotifierService của cùng mốc. Kết quả nghiệm thu và SHA/tag nộp cuối chờ Liêm cùng người chốt release xác nhận.

## REST và quyền

| Method | Route | Hành vi |
|---|---|---|
| POST | /auth/register | 201, luôn tạo customer |
| POST | /auth/login | 200, trả accessToken và user |
| POST | /api/parcels/calculate-fee | Công khai, validate trọng lượng 0–1000 kg và tọa độ, trả fee/currency/details |
| POST | /api/parcels | JWT customer, lưu phí và tọa độ, senderId lấy từ JWT |
| GET | /api/parcels/mine | JWT, lọc senderId của người gọi |
| GET | /api/parcels/assigned/mine | JWT shipper, assignment đang hoạt động |
| GET | /api/parcels/hubs | JWT admin hoặc warehouse_staff, danh sách hub |
| GET | /api/parcels | JWT admin hoặc warehouse_staff |
| GET | /api/parcels/{id} | JWT, chủ đơn/tài xế đang được gán/nhân sự, trả 404 nếu thiếu hoặc không có quyền |
| GET | /api/public/track/{code} | Công khai, 404 khi mã không tồn tại |
| PATCH | /api/parcels/{id}/assign-courier | JWT admin, chọn hub đích và gán pickup |
| PATCH | /api/parcels/{id}/status | JWT, role và guard từ danh tính/DB |

Không có /quote. M1 gọi /calculate-fee. JSON dùng camelCase. Prisma Decimal thường trả chuỗi, adapter chuyển một lần sang number. Lỗi gồm 400 input/transition/hub không hợp lệ, 401 xác thực, 403 sai actor/assignment, 404 không tìm thấy hoặc không được xem, 409 không có tài xế rảnh/cập nhật chồng nhau, 429 quota.

## Chọn hub và gán tài xế

GET /api/parcels/hubs chỉ trả Location.type=hub, chọn id/name/address và sắp tăng dần theo name. Admin và warehouse_staff được gọi.

```json
[
  { "id": "demo-hub-q7", "name": "Hub Quận 7", "address": "Quận 7, TP.HCM" }
]
```

Admin gán đơn mới đã có senderLat/senderLng bằng PATCH /api/parcels/{id}/assign-courier.

```json
{ "destinationHubId": "demo-hub-q7" }
```

destinationHubId phải là hub có thật và được lưu vào Parcel.destinationLocationId. Nếu bỏ trường này, service dùng destinationLocationId đã lưu. Không có hub hợp lệ thì trả 400 “Chọn hub phụ trách giao hàng”.

Với đơn cũ thiếu một trong hai tọa độ người gửi, gửi cả pickupLat và pickupLng. Khi parcel đã có đủ senderLat/senderLng, service ưu tiên cặp tọa độ đã lưu.

```json
{
  "destinationHubId": "demo-hub-q7",
  "pickupLat": 10.7292,
  "pickupLng": 106.6935
}
```

Thiếu cặp tọa độ cho đơn cũ trả 400 “Đơn cũ cần tọa độ lấy hàng”. Không có tài xế rảnh trả 409 và không để lại assignment dở dang. Gán pickup, lưu hub đích, status và history nằm trong transaction Serializable. Sự kiện chỉ phát sau commit.

## Cập nhật trạng thái

Body chỉ có event và hai trường ngữ cảnh hubId/deliveryProofRef theo DTO hiện tại. isHubLocation, isFinalHub, hasDeliveryProof và các cờ guard cũ không thuộc request contract. Service suy quyền sở hữu, assignment, hub hiện tại/đích và số lần thất bại từ DB.

Nhân viên kho nhận tại hub bằng event=arrive_at_hub. hubId là ID Location có type=hub, bắt buộc cho thao tác này. Hub vừa nhận được lưu vào currentLocationId.

```json
{ "event": "arrive_at_hub", "hubId": "demo-hub-q7" }
```

Admin điều phối chặng cuối bằng event=dispatch_last_mile. Service kiểm currentLocationId bằng destinationLocationId và chọn tài xế đang rảnh từ vị trí hub.

```json
{ "event": "dispatch_last_mile" }
```

Tài xế đang được gán xác nhận giao bằng event=confirm_delivery và deliveryProofRef là chuỗi tham chiếu tối đa 200 ký tự, không rỗng sau trim.

```json
{
  "event": "confirm_delivery",
  "deliveryProofRef": "demo-evidence-reference"
}
```

Service lưu chuỗi đã trim vào Parcel.deliveryProof. Hiện mới kiểm tham chiếu không rỗng, chưa xác minh nội dung ảnh/chữ ký hoặc OTP. Những event khác không bắt buộc hubId/deliveryProofRef. assign_courier phải gọi endpoint riêng.

## Dữ liệu và assignment

Parcel lưu feeVnd và senderLat/Lng, receiverLat/Lng lúc tạo. fee giữ trong response tạo đơn để tương thích. Các cột nullable giữ NULL cho dữ liệu cũ chưa biết, UI cần hiển thị “Chưa có dữ liệu” thay vì 0. deliveryProof là dữ liệu nội bộ. driverLatitude/Longitude/LocationAt là snapshot GPS riêng, không dùng timestamp GPS để thay đổi thứ tự timeline.

| Thao tác | Side effect trong ParcelsService |
|---|---|
| Gán pickup | Tạo pickup/assigned, PENDING_PICKUP và destinationLocationId |
| Xác nhận lấy | Assignment của tài xế → in_progress |
| Nhập hub đích | Đóng assignment đang hoạt động, currentLocationId cập nhật từ hubId |
| Điều phối last mile | Tạo last_mile/assigned, OUT_FOR_DELIVERY, xóa GPS cũ về NULL |
| Giao thành công/hoàn trả | Đóng assignment đang hoạt động bằng completed |
| Hủy trước lấy | Đóng assignment bằng cancelled |
| Giao thất bại | Tăng failedAttemptCount |

Job SLA/retry, ticket khiếu nại và vận hành trả hàng đầy đủ vẫn cần nghiệm thu riêng. deliveredAt hiện được gán ở mọi lần updateStatus trong code a230451, vì vậy chưa dùng riêng cột này làm bằng chứng thời điểm giao thành công.

## Hook và Socket.IO

ParcelsService gọi ParcelNotifierService.onTransition sau commit ở create, assign và updateStatus. Hook nhận parcelId, from, to, actor và notification={id, update}. id là ParcelStatusHistory.id đã commit; update được lấy từ đúng parcel/history của transaction, không đọc lại snapshot có thể đã đổi.

Namespace mặc định /. join:parcel và leave:parcel nhận {"trackingCode":"PCL123"} cho room parcel:PCL123. Ack có ok và trackingCode. Client reconnect phải join lại và tải REST snapshot để bù sự kiện bị lỡ. Gateway kiểm định dạng mã, chưa xác nhận tồn tại khi join; REST xác nhận mã.

parcel.status.updated và parcel.delivery.completed giữ cùng format.

```json
{
  "trackingCode": "PCL123",
  "currentStatus": "DELIVERED",
  "event": {
    "status": "DELIVERED",
    "timestamp": "2026-11-25T03:00:00.000Z"
  }
}
```

Timestamp lấy từ history đã lưu. delivery.completed chỉ gửi khi DELIVERED. Wire dùng raw ParcelStatus; mapping nhãn ở m3.md là yêu cầu trình bày. Không gửi phone/address, actor hoặc deliveryProof trong event.

driver:location nhận trackingCode/latitude/longitude. JWT shipper phải có trong handshake auth.token, token trong body không thay thế được handshake. Backend kiểm assignment đang hoạt động, trạng thái đơn, tài khoản shipper active và tọa độ hữu hạn; lưu GPS của parcel/user trước khi phát parcel.location.updated. Payload gồm trackingCode, latitude, longitude, timestamp ISO UTC. Gateway giới hạn 30 message mỗi socket trong 10 giây.

## Tracking snapshot và reconnect

GET /api/public/track/{code} luôn có location. location là null khi chưa có đủ GPS hoặc vừa điều phối last mile và GPS cũ bị xóa. Không dựng tọa độ (0,0) để thay NULL.

```json
{
  "trackingCode": "PCL123",
  "currentStatus": "CREATED",
  "receiverName": "Demo receiver",
  "history": [
    { "status": "CREATED", "timestamp": "2026-11-25T03:00:00.000Z" }
  ],
  "location": null
}
```

Khi có vị trí đã lưu, cùng response dùng location như sau.

```json
{
  "trackingCode": "PCL123",
  "latitude": 10.7292,
  "longitude": 106.6935,
  "timestamp": "2026-11-25T03:06:00.000Z"
}
```

Object trên là giá trị của location, đồng thời là payload parcel.location.updated. M1 tải REST sau reconnect để khôi phục vị trí gần nhất và timeline. GPS có thể là vị trí trình duyệt hoặc mô phỏng, Q03 phải ghi nguồn thực dùng khi demo.

## Webhook HTTP hiện tại

Đối chiếu backend/src/parcels/parcel-notifier.service.ts tại a230451. Cấu hình PARCEL_WEBHOOK_URL và PARCEL_WEBHOOK_SECRET. URL phải là HTTPS, trừ HTTP localhost/127.0.0.1/[::1]. Không cho credentials trong URL. Không đặt URL thì tắt gửi HTTP webhook.

Body POST JSON được tạo bằng JSON.stringify, thứ tự và byte giữ nguyên khi ký.

```json
{
  "eventId": "history-demo-001",
  "type": "parcel.status.updated",
  "occurredAt": "2026-11-25T03:00:00.000Z",
  "data": {
    "trackingCode": "PCL123",
    "currentStatus": "DELIVERED",
    "event": {
      "status": "DELIVERED",
      "timestamp": "2026-11-25T03:00:00.000Z"
    }
  }
}
```

- eventId và X-Webhook-Id cùng là ID history đã commit.
- occurredAt đúng bằng data.event.timestamp của history. X-Webhook-Timestamp là Unix time giây tại lúc gửi.
- X-Webhook-Signature là sha256=<hex chữ thường>. HMAC-SHA256 dùng secret trên timestamp + "." + rawBody UTF-8. Receiver phải dùng rawBody nhận được, không parse rồi stringify lại để xác minh.
- Timeout cố định 2000 ms bằng AbortSignal.timeout(2000), redirect:error. Chưa có biến PARCEL_WEBHOOK_TIMEOUT_MS.
- Lỗi mạng, timeout hoặc receiver ngoài 2xx được log cùng eventId. REST trả kết quả dựa trên DB đã commit, lỗi Socket.IO không ngăn gửi webhook.
- Hiện gửi một lần, chưa có retry tự động/outbox bền vững. Receiver nên kiểm chữ ký constant-time, kiểm cửa sổ timestamp và chống nhận lặp bằng eventId. Cửa sổ 300 giây là gợi ý phía receiver, không phải validation do sender đang thực hiện.

## Seed và giới hạn triển khai

Trong backend, đặt DATABASE_URL tới DB demo, JWT_SECRET riêng, DEMO_SEED_PASSWORD tối thiểu 12 ký tự và tối đa 72 byte. Chạy npx prisma migrate deploy, npx prisma generate và npx prisma db seed.

Seed có customer@example.test, warehouse@example.test, admin@example.test, shipper1@example.test, shipper2@example.test và demo-hub-q7/demo-hub-q1. Tài khoản mới dùng DEMO_SEED_PASSWORD. Seed lại giữ nguyên mật khẩu, vị trí và hub đã tồn tại.

Rate limit HTTP mặc định 120 request/60 giây, quota auth 10/60 giây dùng chung login/register. Quota lưu một process, không dùng chung nhiều replica. Các kết quả migrate/seed/unit trước đây nằm trong GIT_SUBMISSION.md. Chờ Q03 để gắn link CI và ảnh/video của đúng SHA/tag nộp.
