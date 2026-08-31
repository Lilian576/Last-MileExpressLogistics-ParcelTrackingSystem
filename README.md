# LẹMail — Sender App (Customer Frontend)

Frontend module do **M1 (Frontend/UI-UX Lead)** phụ trách, thuộc đồ án
*Last-Mile Express Logistics & Parcel Tracking System* — môn Công nghệ phần
mềm (502045), Nhóm 4 người. Xem phân công đầy đủ tại [`TEAM.md`](../TEAM.md).

### Tuần 3 — Polling tracking (state machine end-to-end)
- `subscribeToParcel()` trong `src/api/parcelApi.ts` được tách thành 2 chiến lược:
  `subscribeToParcelPolling()` (dùng REST, gọi `trackParcel()` lặp lại mỗi
  `POLLING_INTERVAL_MS`, tự dừng khi trạng thái về `DELIVERED`/`RETURNED`) và
  `subscribeToParcelWebSocket()` (dùng cho Tuần 4). Chọn qua cờ
  `REALTIME_MODE: "polling" | "websocket"` — **Tuần 3 để `"polling"`** vì
  TrackingGateway (M2) chưa dựng xong, chỉ có API PATCH status (REST).
  `TrackingPage.tsx` không cần đổi gì khi M2 xong WebSocket ở Tuần 4 — chỉ
  cần đổi `REALTIME_MODE` sang `"websocket"`.
- Badge trạng thái trong `TrackingPage` hiển thị đúng ngữ cảnh: "Tự động cập
  nhật mỗi 4s" (polling) thay vì "Đang theo dõi real-time" (chỉ dùng khi thật
  sự là WebSocket), tránh gây hiểu nhầm cho người chấm.

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

## Cấu trúc thư mục

```
src/
  api/
    parcelApi.ts     # Lớp gọi API — cờ USE_MOCK để chuyển mock ↔ backend thật
    mockBackend.ts   # Backend giả lập trong bộ nhớ, dùng để dev UI độc lập
  components/
    wizard/          # 4 bước tạo đơn
    orders/          # Danh sách đơn của tôi
    tracking/         # Trang tra cứu + timeline
    shared/           # Field.tsx (input wrapper dùng chung)
  lib/
    myOrders.ts      # Lưu trackingCode đã tạo vào localStorage (tạm, chờ Auth)
  types/
    parcel.ts        # Types + STATUS_LABEL + state machine (VALID_TRANSITIONS)
docs/
  WIREFRAME.md       # Đặc tả wireframe/luồng UI (deliverable Tuần 1)
```

## Cách chuyển từ mock sang backend thật

Toàn bộ UI **không cần sửa** khi M2/M3 xong backend — chỉ cần đổi 3 dòng
trong `src/api/parcelApi.ts`:

```ts
export const USE_MOCK = false; // đổi true -> false
export const API_BASE_URL = "https://<domain-backend-thật>";
export const SOCKET_URL = "https://<domain-backend-thật>";
```

Các endpoint UI đang mong đợi từ backend (đối chiếu với M2/M3):

| Hành động        | Method & Path                     | Ghi chú |
|---|---|---|
| Tính phí ship     | `POST /api/parcels/quote`         | Pricing engine (M2) |
| Tạo đơn           | `POST /api/parcels`               | Trả về `Parcel` với `trackingCode` |
| Tra cứu công khai | `GET /api/public/track/:code`     | 404 nếu không tìm thấy |
| Danh sách đơn     | `GET /api/parcels/mine` (+ JWT)   | Cần AuthModule (M3) xong trước |
| Realtime tracking | WebSocket `join:parcel` / event `parcel.status.updated`, `parcel.delivery.completed` | TrackingGateway (M2, Tuần 4) |

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
