# LẹMail — Sender App (Customer Frontend)

Frontend module do **M1 (Frontend/UI-UX Lead)** phụ trách, thuộc đồ án
*Last-Mile Express Logistics & Parcel Tracking System* — môn Công nghệ phần
mềm (502045), Nhóm 4 người. Xem phân công đầy đủ tại [`TEAM.md`](../TEAM.md).

## Đã hoàn thành

### Tuần 1 — Wireframe & luồng UI
- Wireframe + user flow cho toàn bộ Customer flow: xem [`docs/WIREFRAME.md`](./docs/WIREFRAME.md).
- Đối chiếu 1-1 với UI thật đã dựng trong `src/components/`.

### Tuần 2 — Customer UI kết nối API
- **Wizard tạo đơn** 4 bước (`src/components/wizard/`): người gửi/nhận →
  kiện hàng → xác nhận & tính phí (gọi `getQuote`) → xác nhận đặt đơn (gọi
  `createParcel`) → hoàn tất.
- **Xem danh sách đơn** (`src/components/orders/OrdersPage.tsx`, route
  `/orders`): liệt kê các đơn đã tạo trên trình duyệt hiện tại (mã, người
  nhận, trạng thái, phí, thời gian tạo), bấm vào 1 dòng để xem chi tiết/tracking.
- **Tra cứu công khai** (`src/components/tracking/`, route `/tracking/:code`):
  xem lịch sử trạng thái + cập nhật real-time qua WebSocket (mock).

### Tuần 3 — Polling tracking (state machine end-to-end)
- `subscribeToParcel()` trong `src/api/parcelApi.ts` được tách thành 2 chiến lược:
  `subscribeToParcelPolling()` (dùng REST, gọi `trackParcel()` lặp lại mỗi
  `POLLING_INTERVAL_MS`, tự dừng khi trạng thái về trạng thái cuối) và
  `subscribeToParcelWebSocket()` (dùng cho Tuần 4). Chọn qua cờ
  `REALTIME_MODE: "polling" | "websocket"`.

### Tuần 4 — WebSocket client thật + reconnect
- `REALTIME_MODE` chuyển sang `"websocket"` — `TrackingPage` nhận cập nhật
  qua Socket.io thay vì polling.
- `subscribeToParcelWebSocket()`: bật `reconnection: true` (tự kết nối lại
  vô hạn, delay tăng dần tới 5s); mỗi lần `connect` (kể cả sau khi mất mạng
  rồi có lại) đều `emit("join:parcel")` lại **và** gọi `trackParcel()` để
  resync snapshot mới nhất — tránh bỏ sót event nếu rớt mạng đúng lúc backend
  emit.
- Nút demo "🔌 Giả lập mất mạng 3s" trong `TrackingPage` (chỉ hiện khi
  `USE_MOCK=true`) để demo hành vi reconnect ngay cả khi chưa nối được
  backend WebSocket thật.

### Tuần 2–3 — Driver UI (tài xế)
- `/driver/login` (`DriverLoginPage`): đăng nhập bằng `POST /auth/login`, chỉ nhận
  tài khoản role `shipper`; token lưu ở `lib/driverSession.ts`.
- `/driver` (`DriverOrdersPage` + `DriverParcelCard`): danh sách đơn được giao
  (`GET /api/parcels/assigned/mine`), tự làm mới mỗi 15s + nút "Làm mới".
- **Nút cập nhật trạng thái** chỉ hiện đúng các bước mà actor `shipper` được phép
  theo `transition-table.ts` (xem `SHIPPER_ACTIONS` trong `types/driver.ts`):
  `PENDING_PICKUP→PICKED_UP`, `PICKED_UP→IN_TRANSIT`,
  `OUT_FOR_DELIVERY→DELIVERED | DELIVERY_FAILED`, `RETURNING→RETURNED`.
  "Giao thành công" bị khóa tới khi tick "đã có bằng chứng giao hàng" (guard
  `hasDeliveryProof`). Các bước còn lại (kho/điều phối/hệ thống) hiển thị lý do chờ.
- Gọi `PATCH /api/parcels/:id/status` — mọi luật vẫn do `StateMachineService`
  kiểm tra lại ở backend; lỗi 400/403 hiện ngay trên thẻ đơn, 401 → về trang login.

### Tuần 4 — Hợp đồng WebSocket (M1 ↔ M2)
| Chiều | Event | Payload |
|---|---|---|
| client → server | `join:parcel` / `leave:parcel` | `{ trackingCode }` (server ack `{ ok, trackingCode }`) |
| server → room `parcel:<trackingCode>` | `parcel.status.updated` | `{ trackingCode, currentStatus, event: { status, timestamp, note? } }` |
| server → room | `parcel.delivery.completed` | cùng payload, chỉ khi `DELIVERED` |

Payload là **bản vá** (trạng thái mới + 1 mốc lịch sử), không phải cả `Parcel`:
client giữ bản nền từ REST và ghép vào (`lib/parcelUpdates.ts`), nên backend
không phải dựng lại `Parcel` của Frontend. Sau mỗi (re)connect client join lại
room + resync REST; snapshot cũ hơn dữ liệu đang có sẽ bị bỏ qua (không lùi trạng thái).

Backend phát event trong `ParcelsService.updateStatus()` **sau khi** DB lưu thành
công (cùng transaction ghi `parcel_status_history`).

### Demo 2 màn hình song song (chế độ mock, không cần backend)
`mockBackend` lưu dữ liệu vào `localStorage` và phát event qua `BroadcastChannel`,
nên 2 tab cùng trình duyệt dùng chung dữ liệu:
1. Tab A: tạo đơn ở `/`, mở `/tracking/<mã>`; bấm nút demo `→ PENDING_PICKUP`
   (đóng vai điều phối gán tài xế).
2. Tab B: `/driver/login` (`driver@demo.vn` / `123456`) → bấm "Đã lấy hàng" …
   → tab A cập nhật ngay, không reload.
3. Các bước của kho (`→ AT_HUB`, `→ OUT_FOR_DELIVERY`) bấm bằng nút demo ở tab A.
`MOCK_AUTO_PROGRESS` (trong `mockBackend.ts`) mặc định **tắt** để tài xế có việc để làm;
đặt `true` nếu muốn đơn tự chạy tới DELIVERED khi demo riêng màn hình khách.

Chạy với backend thật: `VITE_USE_MOCK=false npm run dev` (xem `.env.example`).

### ⚠️ Đối chiếu với code backend thật (đọc trực tiếp từ repo `backend/src`)

Sau khi đọc code thật của M2/M3, phát hiện vài điểm CẦN THỐNG NHẤT LẠI trước
khi tắt `USE_MOCK`:

1. **Enum trạng thái đã được sửa khớp 100%** với
   `backend/prisma/schema.prisma` (enum `ParcelStatus`) và
   `backend/src/state-machine/transition-table.ts` — 12 trạng thái:
   `CREATED, PENDING_PICKUP, PICKED_UP, IN_TRANSIT, AT_HUB,
   OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED, RETURNING, RETURNED,
   CANCELLED, LOST` (trước đó `types/parcel.ts` dùng enum tự đoán, đã lệch —
   nay đã đồng bộ).
2. ~~Gateway chỉ có ping/pong~~ → **đã bổ sung**: `join:parcel`, `leave:parcel`
   và `emitStatusUpdated()` (gọi từ `ParcelsService.updateStatus`); có test
   WebSocket thật ở `backend/src/tracking/tracking.gateway.spec.ts`. M4: test
   e2e cũ `tracking.e2e-spec.ts` đang emit `joinRoom` — cần đổi thành `join:parcel`.
3. **`POST /api/parcels` hiện dùng DTO tối giản** (`senderName, senderLat,
   senderLng, receiverName, receiverLat, receiverLng, weightKg` — tính khoảng
   cách bằng công thức Haversine), khác với model `Parcel` đầy đủ trong
   `schema.prisma` (có `receiverPhone`, `receiverAddress` dạng chuỗi,
   `dimensions`, `codAmount`, và `senderId` lấy từ user đăng nhập chứ không
   phải nhập tay). `ParcelsService` hiện cũng đang lưu **in-memory**, chưa
   nối Prisma. → Đây là điểm quan trọng nhất cần họp lại giữa M1 ↔ M2 ↔ M3
   trước khi tích hợp thật, vì 2 phía đang thiết kế request/response khác
   nhau khá nhiều.
4. **`POST /api/parcels` yêu cầu JWT** (`@UseGuards(JwtAuthGuard)`) — nghĩa
   là sender-app cần có **màn hình đăng nhập** và đính kèm
   `Authorization: Bearer <token>` trước khi gọi tạo đơn. Hiện tại UI M1
   chưa có bước đăng nhập nào — cần bổ sung trước khi tắt mock.
5. `GET /api/parcels/:id` hiện tra theo **id số** (`Number(id)`), không phải
   theo `trackingCode` — cần thống nhất lại route tra cứu công khai theo
   `trackingCode` (như M1 đang thiết kế) để không lộ ID tuần tự.

**Khuyến nghị:** giữ `USE_MOCK = true` để tiếp tục demo UI mượt, đồng thời
đem đúng 5 điểm trên vào buổi họp M1↔M2↔M3 tiếp theo để chốt lại contract
trước khi nối thật.

## Cấu trúc thư mục

```
src/
  api/
    parcelApi.ts     # Lớp gọi API — cờ USE_MOCK để chuyển mock ↔ backend thật
    mockBackend.ts   # Backend giả lập (localStorage + BroadcastChannel), dev UI độc lập
    driverApi.ts     # Login / danh sách đơn / cập nhật trạng thái của tài xế
    errors.ts        # AuthExpiredError (401)
  components/
    wizard/          # 4 bước tạo đơn
    orders/          # Danh sách đơn của tôi
    driver/          # Driver UI: login + danh sách đơn + nút cập nhật
    tracking/         # Trang tra cứu + timeline
    shared/           # Field.tsx (input wrapper dùng chung)
  lib/
    myOrders.ts      # Lưu trackingCode đã tạo vào localStorage (tạm, chờ Auth)
    driverSession.ts # Lưu JWT tài xế
    parcelUpdates.ts # Ghép bản vá realtime vào Parcel
  types/
    parcel.ts        # Types + STATUS_LABEL + state machine (VALID_TRANSITIONS)
    driver.ts        # Types tài xế + SHIPPER_ACTIONS (bước shipper được phép)
docs/
  WIREFRAME.md       # Đặc tả wireframe/luồng UI (deliverable Tuần 1)
```

## Cách chuyển từ mock sang backend thật

Đổi bằng biến môi trường (`.env.local`, xem `.env.example`) hoặc 3 hằng số
trong `src/api/parcelApi.ts`:

```ts
export const USE_MOCK = false; // đổi true -> false
export const API_BASE_URL = "https://<domain-backend-thật>";
export const SOCKET_URL = "https://<domain-backend-thật>";
```

Các endpoint UI đang mong đợi từ backend (đối chiếu với M2/M3):

| Hành động        | Method & Path (frontend đang gọi) | Method & Path THẬT trong backend hiện tại | Ghi chú |
|---|---|---|---|
| Tính phí ship     | `POST /api/parcels/quote`         | `POST /api/parcels/calculate-fee` (DTO khác: lat/lng thay vì province) | Cần thống nhất lại request/response |
| Tạo đơn           | `POST /api/parcels`               | `POST /api/parcels` (đúng path, khác DTO + cần JWT) | Backend yêu cầu login trước |
| Tra cứu công khai | `GET /api/public/track/:code`     | Đã có (`PublicTrackingController`) | Chỉ trả trackingCode, trạng thái, tên người nhận, lịch sử — không lộ SĐT/địa chỉ; mã không tồn tại → 404 |
| Danh sách đơn     | `GET /api/parcels/mine` (+ JWT)   | Chưa có | Cần AuthModule (M3) + route mới từ M2 |
| Realtime tracking | WebSocket `join:parcel` / event `parcel.status.updated`, `parcel.delivery.completed` | Đã có (xem mục Hợp đồng WebSocket) | Test tích hợp `backend/src/parcels/parcels.realtime.spec.ts` chạy cả chuỗi: snapshot REST → join room → tài xế PATCH status → nhận event |
| Driver: đăng nhập | `POST /auth/login` | Đúng (không có prefix `/api`) | |
| Driver: đơn được giao | `GET /api/parcels/assigned/mine` (+ JWT, role shipper) | Đã thêm | Đơn xuất hiện khi điều phối gọi `PATCH /api/parcels/:id/assign-courier` (tạo `delivery_assignments` status=assigned) |
| Driver: cập nhật trạng thái | `PATCH /api/parcels/:id/status` | Đúng | Backend nay ghi thêm `parcel_status_history` |

> Xem chi tiết đầy đủ ở mục "⚠️ Đối chiếu với code backend thật" phía trên —
> đây là danh sách việc cần chốt lại giữa M1 ↔ M2 ↔ M3 trước khi tắt mock.

## Chạy dự án

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build production (tsc -b && vite build)
npm run lint      # oxlint
```

## Tech stack

React 19 + TypeScript + Vite, React Router v7, Socket.io-client (cho realtime
tracking thật ở Tuần 4).
