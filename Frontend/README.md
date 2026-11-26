# CloudShip — Frontend (Sender / Driver / Ops)

Frontend do **M1 (Frontend/UI-UX Lead)** phụ trách, thuộc đồ án *Last-Mile Express Logistics & Parcel Tracking System*
(môn Công nghệ phần mềm 502045, nhóm 4 người — xem [`TEAM.md`](../TEAM.md)).
React 19 + TypeScript + Vite, React Router v7, Socket.io-client, Leaflet (bản đồ OpenStreetMap).

- Wireframe & luồng UI: [`docs/WIREFRAME.md`](../docs/WIREFRAME.md)
- Contract tích hợp M2/M3: [`docs/INTEGRATION.md`](../docs/INTEGRATION.md)

## 1. Chạy UI với backend thật (dùng cho nghiệm thu)

**Backend** (thư mục `backend`, cần PostgreSQL — xem `backend/.env.example`):

```bash
cd backend
npm ci
# .env: DATABASE_URL, JWT_SECRET, DEMO_SEED_PASSWORD (>= 12 ký tự, chỉ dùng cho DB phát triển)
npx prisma migrate deploy
npx prisma db seed        # tạo admin@example.test, shipper1@example.test, shipper2@example.test và 2 hub
npm run start:dev         # http://localhost:3000
```

**Frontend**:

```bash
cd Frontend
npm ci
npm run dev               # http://localhost:5173 — mặc định gọi backend thật tại http://localhost:3000
```

Tài khoản: khách tự đăng ký ở `/register`; `admin@example.test`, `shipper1@example.test`, `shipper2@example.test` có mật khẩu
`DEMO_SEED_PASSWORD`. **Seed hiện chưa có tài khoản `warehouse_staff`** (xem mục 6).

## 2. Chạy UI ở chế độ mock (chỉ để dev giao diện, KHÔNG dùng để nghiệm thu)

```bash
cd Frontend
VITE_USE_MOCK=true npm run dev
```

Mock lưu dữ liệu trong `localStorage` và phát event qua `BroadcastChannel` nên 2 tab cùng trình duyệt dùng chung dữ liệu
(tab A: khách tạo đơn, dùng nút demo `→ PENDING_PICKUP`; tab B: `/driver/login` với `driver@demo.vn` / `123456`).
Mock **không** hỗ trợ màn hình vận hành `/ops` — màn này chỉ chạy với backend thật.

### Biến môi trường (`.env.local`, xem `.env.example`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_USE_MOCK` | `false` | `true` = dùng mock thay backend |
| `VITE_API_BASE_URL` | `http://localhost:3000` | URL REST của backend |
| `VITE_SOCKET_URL` | = `VITE_API_BASE_URL` | URL Socket.io |

## 3. Màn hình, route và quyền

| Route | Vai trò (JWT `role`) | Chức năng |
|---|---|---|
| `/login`, `/register` | khách (`customer`) | Đăng nhập / đăng ký (tài khoản nội bộ bị từ chối ở trang này) |
| `/new` | `customer` | Wizard 4 bước: thông tin → kiện hàng → **báo giá + phí** (`calculate-fee`) → đặt đơn |
| `/orders` | `customer` | Đơn của tôi, tải lại từ server (`GET /api/parcels/mine`) |
| `/tracking`, `/tracking/:code` | công khai | Tra cứu + timeline + bản đồ tài xế, real-time |
| `/driver/login`, `/driver` | `shipper` | Đơn được giao; chỉ hiện nút hợp lệ với trạng thái; phát GPS cho khách |
| `/ops/login`, `/ops` | `admin`, `warehouse_staff` | Tìm/lọc đơn, gán tài xế, tiếp nhận tại hub, điều phối |

Phiên đăng nhập của 3 nhóm lưu ở 3 key `localStorage` riêng, nên tải lại trang vẫn giữ phiên và dữ liệu luôn lấy lại từ server.

### Thao tác theo trạng thái (bám `backend/src/state-machine/transition-table.ts`)

| Trạng thái | Ai thao tác | Event |
|---|---|---|
| `CREATED` | `admin` | gán tài xế gần nhất (`PATCH /api/parcels/:id/assign-courier`, cần toạ độ điểm lấy hàng) |
| `PENDING_PICKUP` | `shipper` | `confirm_pickup` |
| `PICKED_UP` | `shipper` | `depart_to_hub` |
| `IN_TRANSIT` | `warehouse_staff` | `arrive_at_hub` (`isHubLocation: true`) |
| `AT_HUB` | `warehouse_staff` | `dispatch_to_next_hub` (`isFinalHub: false`) |
| `AT_HUB` → `OUT_FOR_DELIVERY` | `admin` (kiêm điều phối, theo D01) | `dispatch_last_mile` (`isFinalHub: true`) — **cần M3 thêm `admin` vào `allowedActors`**, xem mục 6 |
| `OUT_FOR_DELIVERY` | `shipper` | `confirm_delivery` (cần `hasDeliveryProof`) / `report_failed_delivery` |
| `RETURNING` | `shipper` | `confirm_return_to_sender` |

## 4. Contract API đã đối chiếu với code backend

| Hành động | Endpoint | Auth |
|---|---|---|
| Đăng ký / đăng nhập | `POST /auth/register`, `POST /auth/login` | — |
| Tính phí | `POST /api/parcels/calculate-fee` → `{ fee, currency, details }` | — |
| Tạo đơn | `POST /api/parcels` (`CreateParcelDto`: người nhận, `weightKg`, 4 toạ độ) | JWT |
| Đơn của tôi | `GET /api/parcels/mine` | JWT |
| Tra cứu công khai | `GET /api/public/track/:code` (404 = mã không tồn tại) | — |
| Đơn của tài xế | `GET /api/parcels/assigned/mine` | JWT + `shipper` |
| Cập nhật trạng thái | `PATCH /api/parcels/:id/status` `{ event, ...guard }` | JWT |
| Gán tài xế | `PATCH /api/parcels/:id/assign-courier` `{ pickupLat, pickupLng }` | JWT |
| Danh sách đơn (vận hành) | `GET /api/parcels` | hiện **không yêu cầu** JWT (xem mục 6) |

### WebSocket (Socket.io, `TrackingGateway`)

| Chiều | Event | Payload |
|---|---|---|
| client → server | `join:parcel` / `leave:parcel` | `{ trackingCode }`, ack `{ ok, error? }` |
| server → room `parcel:<code>` | `parcel.status.updated`, `parcel.delivery.completed` | `{ trackingCode, currentStatus, event: { status, timestamp, note? } }` |
| client (tài xế) → server | `driver:location` | `{ trackingCode, latitude, longitude }` (handshake `auth.token` = JWT) |
| server → room | `parcel.location.updated` | `{ trackingCode, latitude, longitude, timestamp }` |

Hành vi client (`subscribeToParcelRealtime` trong `src/api/parcelApi.ts`):

- **Một socket duy nhất** cho mỗi trang tracking (trạng thái + vị trí); cleanup gỡ toàn bộ listener và đóng socket; cờ chống race xử lý
  StrictMode/đổi mã nên không rò rỉ socket.
- Chỉ báo đang kết nối sau khi server xác nhận `join:parcel`; mỗi lần vào room (kể cả reconnect, delay tăng dần tới 5s)
  tải lại snapshot REST để bù event trạng thái và vị trí GPS bị lỡ. Snapshot chứa GPS gần nhất đã lưu; dữ liệu cũ hơn
  vị trí đang hiển thị bị bỏ qua.
- Payload trạng thái sai dạng → không ghép bừa mà tải lại snapshot REST.
- UI phân biệt rõ: *mã không tồn tại* (404), *lỗi API / không kết nối* (có nút Thử lại), *mất kết nối real-time*
  (cảnh báo + giờ đồng bộ cuối + giữ vị trí gần nhất đã nhận trong phiên).
- Tài xế: tạm dừng gửi GPS khi socket mất kết nối và báo rõ; nhãn "GPS thiết bị" / "GPS giả lập" hiển thị ở màn hình tài xế.

### Chạy thủ công Q03 reconnect (backend thật, không dùng mock)

1. Khởi động PostgreSQL/backend và frontend theo mục 1; giữ `VITE_USE_MOCK=false`, và đặt `VITE_API_BASE_URL`/`VITE_SOCKET_URL`
   cùng trỏ tới backend đang chạy. Khởi động lại frontend sau khi đổi cấu hình hoặc cập nhật mã.
2. Mở `/driver` bằng tài khoản shipper đang được gán một đơn `OUT_FOR_DELIVERY`; mở `/tracking/<trackingCode>` trong tab khách riêng.
   Xác nhận trang tài xế bật chia sẻ vị trí và ghi lại nhãn nguồn `GPS thiết bị` hoặc `GPS giả lập`.
3. Chỉ trong tab khách, dùng DevTools → Network conditions → `Offline`. Để tab tài xế online; đợi nhãn `gửi lúc` trên tài xế tiến lên
   và ghi lại thời điểm/nguồn GPS.
4. Trên chính tab khách, chuyển Network conditions về `Disabled: No throttling`, không reload/F5. Chờ trang báo real-time và đối chiếu vị trí
   cùng thời gian cập nhật với snapshot `GET /api/public/track/<trackingCode>`.
5. Để tài xế gửi thêm một GPS tick; xác nhận cùng tab khách tự cập nhật tiếp mà không reload. Lưu SHA chạy, thời điểm, nguồn GPS và ảnh
   của trạng thái offline, tài xế gửi vị trí, khách đồng bộ lại. Chỉ đánh dấu PASS nếu thấy cả vị trí bị lỡ sau reconnect và tick tiếp theo;
   ghi rõ phần nào chưa xác minh được.

## 5. Kiểm tra

```bash
cd Frontend
npm run lint     # oxlint
npm test         # vitest (jsdom, chạy với mock, không cần backend)
npm run build    # tsc -b && vite build
```

CI (`.github/workflows/ci.yml`) chạy đúng 3 lệnh trên với Node 22.

## 6. Phần bị chặn / phụ thuộc module khác

| # | Vấn đề | Phụ thuộc |
|---|---|---|
| 1 | `dispatch_last_mile` trong `transition-table.ts` hiện chỉ cho actor `dispatcher` (enum `Role` không có). UI đã đặt nút cho `admin` theo D01 nên **backend trả 403 cho tới khi M3 thêm `admin` vào `allowedActors`**; sau đó không cần sửa UI. | M3 |
| 2 | Seed không có tài khoản `warehouse_staff` → chưa thể demo tiếp nhận tại hub trên DB mới. | M3 |
| 3 | Backend không lưu / không trả vị trí GPS gần nhất; `parcel.location.updated` không có trường nguồn (thật/giả lập) → khách chỉ thấy vị trí nhận được trong phiên và không phân biệt được nguồn. | M2 |
| 4 | `assignCourier` không emit `parcel.status.updated` → trang tracking của khách không tự cập nhật khi đơn chuyển `CREATED → PENDING_PICKUP`. | M2 |
| 5 | Trên `main`, `GET /api/parcels` (gồm SĐT/địa chỉ) chưa yêu cầu JWT/role; nhánh `fix/m2-backend` đã giới hạn cho `admin`/`warehouse_staff`. UI luôn gửi Bearer nên chạy được với cả hai. | M2 (merge B02) |
| 6 | Các cờ guard (`isAssignedCourier`, `isHubLocation`, `isFinalHub`, `hasDeliveryProof`) do client gửi và backend tin theo; `INTEGRATION.md` yêu cầu lấy từ DB. `driver:location` trên `main` chưa xác thực JWT (đã có ở `fix/m2-backend`; UI đã gửi `auth.token`). | M2/M3 |
| 7 | `docs/INTEGRATION.md` mô tả payload `parcel.status.updated` là `{ trackingCode, status, updatedAt }` (nhãn rút gọn), còn code gateway phát `{ trackingCode, currentStatus, event }`. Frontend bám code; cần M2/M3 chốt bản nào là chuẩn. | M2/M3 |
| 8 | Phí (`fee`) không lưu DB → "Đơn của tôi" ẩn phí; địa chỉ/toạ độ người gửi không được lưu. | M2 |
| 9 | Chưa có link Figma trong repo. | M1 bổ sung (xem `docs/WIREFRAME.md`) |
| 11 | Xác nhận giao hàng vẫn là checkbox → cờ `hasDeliveryProof`; backend chưa có trường dữ liệu bằng chứng (ảnh/chữ ký). Chờ contract D01. | M3 |
| 10 | Chưa chạy E2E với backend thật trong môi trường CI/sandbox (cần PostgreSQL); `npm test` dùng mock fetch/socket. | M4 |

## 6b. Cấu trúc thư mục

```
Frontend/
  src/
    api/          parcelApi (REST + realtime), driverApi, opsApi, authApi, contract (ánh xạ DTO), errors, mockBackend
    components/   wizard/ orders/ tracking/ driver/ ops/ auth/ shared/
    lib/          session, driverSession, opsSession, driverGps, geo, parcelUpdates, myOrders (chỉ cho mock)
    types/        parcel, driver, ops, auth
    test/         setup
  public/favicon.svg
```

Không có thư mục `src/` ở gốc repo (bản sao đã bị xóa) — mọi mã nguồn Frontend nằm trong `Frontend/src/`.
Đã xóa các asset không còn được tham chiếu: `src/assets/{hero.png,react.svg,vite.svg}`, `public/icons.svg`.
