# Bàn giao phần M2

Bản làm việc `fix/m2-final` xuất phát từ `main` tại `8b61f25`. Các thay đổi phù hợp ở `ec57bc3` được lấy theo file để giữ phiên bản frontend và CI hiện tại. Thứ tự áp dụng theo mã việc trong kế hoạch.

## 1. R01 – Chuẩn bị tích hợp

1. Tạo issue từ các User Story trong `docs/issues/`, gắn một assignee cho mỗi issue và liên kết các đầu việc B01–B03 với issue tương ứng. Thêm issue vào Project với các cột Backlog, In Progress, Review và Done.
2. Đối chiếu contract bên dưới với M1, M3 và M4. M3 review migration và seed trước khi merge. M1 review ba file tài xế đã đồng bộ trường xác nhận giao.
3. Đồng bộ các thay đổi đã có trên `main` vào `develop` thông qua nhánh tích hợp. Giữ workflow frontend trên `main` khi đưa Docker và E2E từ PR #27 vào. Mở PR của M2 vào `develop` sau khi xử lý xung đột. PR cần reviewer khác tác giả. Dùng squash cho feature PR theo TEAM.md.
4. Trong Settings → Rules, kích hoạt rule cho `main`, yêu cầu PR, ít nhất một approval và các CI check của bản tích hợp. Khi phát hành, mở PR từ ứng viên đã kiểm thử vào `main`.

## 2. B01 – Vòng đời đơn và dữ liệu

| File | Vị trí và mục đích |
|---|---|
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261125090000_parcel_workflow_data/migration.sql` | Model `Parcel`. Thêm phí, tọa độ gửi/nhận, mã tham chiếu giao hàng và vị trí tài xế mới nhất. Các cột mới nullable để giữ tương thích với đơn cũ. M3 kiểm tra migration trong nhánh tích hợp. |
| `backend/prisma/seed.ts` | Thêm `warehouse@example.test` bên cạnh admin, hai shipper và các hub đã có. Dùng biến `DEMO_SEED_PASSWORD` trên DB phát triển. |
| `backend/src/parcels/parcels.service.ts` | `create` ghi phí, mã ngẫu nhiên và mốc CREATED. `assignCourier` dùng tọa độ đã lưu, chọn hub và gán tài xế trong transaction. `updateStatus` kiểm tra vai trò, owner, assignment, hub và xác nhận giao. Qua hub cuối thì đóng assignment lấy hàng, điều phối chặng cuối tạo assignment mới, giao thành công đóng assignment. |
| `backend/src/parcels/driver-assignment.service.ts`, `backend/src/common/geo.ts` | Tìm tài xế còn rảnh trong cùng transaction, dùng chung Haversine với tính phí. |
| `backend/src/parcels/*dto.ts` | Kiểm tra đầu vào báo giá, tạo đơn, gán tài xế và sự kiện đổi trạng thái. |

### Contract cho M1 và M4

| Người dùng | Request | Nội dung |
|---|---|---|
| Khách | `POST /api/parcels` | Payload tạo đơn giữ các trường đang dùng. API trả `fee` dạng số và giữ phí để đọc lại ở `GET /api/parcels/mine`. |
| Admin hoặc kho | `GET /api/parcels/hubs` | Danh sách `id`, `name`, `address` của các hub dùng cho thao tác điều phối. |
| Admin | `PATCH /api/parcels/:id/assign-courier` | `{ "destinationHubId": "demo-hub-q7" }`. Đơn cũ chưa có tọa độ cần thêm `pickupLat` và `pickupLng`. Kết quả có `parcel` và `assignmentResult`. |
| Tài xế đang được giao | `PATCH /api/parcels/:id/status` | Gửi lần lượt `{ "event": "confirm_pickup" }` và `{ "event": "depart_to_hub" }`. |
| Nhân viên kho | `PATCH /api/parcels/:id/status` | `{ "event": "arrive_at_hub", "hubId": "demo-hub-q7" }`. Backend đối chiếu hub và hub đích trong DB. |
| Admin | `PATCH /api/parcels/:id/status` | `{ "event": "dispatch_last_mile" }`. Admin đóng vai dispatcher ở tầng nghiệp vụ. Service gán một tài xế rảnh gần hub cuối. |
| Tài xế chặng cuối | `PATCH /api/parcels/:id/status` | `{ "event": "confirm_delivery", "deliveryProofRef": "DEMO-POD-001" }`. Trường này là mã tham chiếu do vận hành cung cấp, lưu tối đa 200 ký tự. Đây là phiên bản xác nhận giao tối thiểu. |
| Công khai | `GET /api/public/track/:code` | Giữ `trackingCode`, `currentStatus`, `receiverName`, `history`. Thêm `location` dưới dạng vị trí mới nhất hoặc `null`. |

M1 dùng contract trên để làm màn hình kho/điều phối và đọc `location` khi resync tracking. Ba file `Frontend/src/api/driverApi.ts`, `components/driver/DriverOrdersPage.tsx` và `components/driver/DriverParcelCard.tsx` đã có phần đồng bộ tối thiểu cho `deliveryProofRef`.

Nghiệp vụ đã kiểm tra trên tuyến có một hub đích. Những bước tự động do actor `system` thực hiện, như lịch giao lại và timeout SLA, vẫn cần cơ chế vận hành riêng nếu nhóm công bố chúng trong phạm vi demo. Có thể kiểm tra nhánh giao thất bại bằng nghiệp vụ đang có và ghi rõ giới hạn trong SRS.

## 3. B02 – Phân quyền và WebSocket

- `backend/src/parcels/parcels.controller.ts` giới hạn danh sách toàn bộ đơn cho admin và kho. API chi tiết yêu cầu JWT, kiểm tra người gửi, tài xế đang được giao hoặc nhân sự nội bộ. `/mine` và `/assigned/mine` giữ đường dẫn hiện tại.
- `backend/src/tracking/tracking.gateway.ts` kiểm tra JWT shipper và assignment đang hoạt động trước khi ghi GPS. Lưu vị trí của đơn và tài xế trong transaction rồi mới phát `parcel.location.updated`. Payload giữ `trackingCode`, `latitude`, `longitude`, `timestamp`.
- `backend/src/parcels/parcel-notifier.service.ts` thực thi `onTransition` sau commit. Các sự kiện `parcel.status.updated` và `parcel.delivery.completed` giữ nguyên shape đang dùng trên frontend. `join:parcel` và `leave:parcel` giữ tham số `trackingCode`. ID của bản ghi history dùng để đối chiếu sự kiện với DB.

## 4. B03 – Webhook trạng thái

Cấu hình `PARCEL_WEBHOOK_URL` và `PARCEL_WEBHOOK_SECRET` theo `backend/.env.example`. URL nhận phải là HTTPS khi triển khai, hoặc HTTP loopback để test cục bộ. Khi webhook được bật, mỗi trạng thái ghi thành công gửi một POST chứa:

```json
{
  "id": "<status-history-id>",
  "type": "parcel.status.updated",
  "parcelId": "<parcel-id>",
  "trackingCode": "<tracking-code>",
  "previousStatus": "AT_HUB",
  "status": "OUT_FOR_DELIVERY",
  "actor": "dispatcher",
  "occurredAt": "<ISO-8601>"
}
```

Receiver đối chiếu header `x-parcel-signature` với HMAC SHA-256 trên raw body. Dùng `id` để nhận diện bản ghi đã xử lý. Webhook timeout sau 2 giây và ghi log khi không gửi được hoặc khi receiver trả lỗi. Gửi theo cơ chế thử một lần sau commit. Phần tích hợp này chưa có hàng đợi bền vững hoặc retry tự động. M3 mô tả contract này trong OpenAPI 3.1.

## 5. Chạy thử và R02 – Đóng băng

1. Chuẩn bị PostgreSQL riêng. Đặt `DATABASE_URL`, `JWT_SECRET` và `DEMO_SEED_PASSWORD` theo file env mẫu trong backend.
2. Trong `backend/`, chạy `npm ci`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run build`, `npx prisma db seed`, `npm test -- --runInBand`, rồi `npm run start:prod`.
3. Trong `Frontend/`, chạy `npm ci`, `npm run build`, `npm test`. Khi demo, dùng API thật, đăng nhập tài xế chặng tương ứng trong phiên riêng. Dùng API admin/kho cho đến khi màn hình M1 đã nối xong.
4. M4 tích hợp kịch bản PostgreSQL từ tạo đơn đến DELIVERED và kiểm tra quyền, room WebSocket, reconnect, webhook trên cùng workflow. M2 đối chiếu kết quả với checklist bản nộp.
5. Sau khi đủ review, CI và checklist, lưu SHA/tag, link PR/CI, cách dựng demo và link báo cáo. M3 chốt tài liệu cùng phiên bản. Phần GitHub Settings, issue và PR phát hành cần thao tác trên repository chính.
