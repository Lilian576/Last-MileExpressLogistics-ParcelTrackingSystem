# Wireframe UI — Customer Flow (M1, Tuần 1)

> **Figma:** repo hiện **chưa có link Figma** nào (đã rà `README`, `TEAM.md`, `docs/`). M1 cần dán link file Figma
> vào dòng dưới rồi kiểm tra quyền truy cập (Anyone with the link → View) trước khi nộp:
>
> `Figma: <CHƯA CÓ LINK — M1 bổ sung>`
>
> Tài liệu này mô tả wireframe dạng văn bản/ASCII, đối chiếu với UI thật trong `Frontend/src/components/`.

## 1. Sơ đồ luồng (User Flow)

```
                         ┌────────────────────┐
                         │   "/"  Tạo đơn      │
                         │   (Wizard 4 bước)   │
                         └─────────┬───────────┘
                                   │ đặt đơn thành công
                                   ▼
                         ┌────────────────────┐
              ┌──────────┤  Step 4: Thành công │
              │          └─────────┬──────────┘
              │                    │
   "Theo dõi đơn ngay"     "Xem danh sách đơn"
              │                    │
              ▼                    ▼
   ┌────────────────────┐  ┌────────────────────┐
   │ "/tracking/:code"   │  │   "/orders"        │
   │ Chi tiết + realtime │  │ Danh sách đơn của  │
   │ timeline             │  │ tôi (từ server)   │
   └─────────┬───────────┘  └─────────┬──────────┘
             │  click 1 dòng           │
             └────────────────────────►┘
                (điều hướng 2 chiều giữa danh sách và chi tiết)

   Ngoài ra: "/tracking" (không có :code) cho phép khách nhập tay
   mã vận đơn để tra cứu công khai, không cần đã tạo đơn trên máy này.
```

## 2. Màn hình: Wizard tạo đơn — Bước 1/4 "Người gửi / Người nhận"

```
┌──────────────────────────────────────────────────────────┐
│ CloudShip                        [Tạo đơn] [Đơn của tôi] [Tra cứu]
├──────────────────────────────────────────────────────────┤
│ ① Người gửi / nhận  ② Kiện hàng  ③ Xác nhận  ④ Hoàn tất   │  ← stepper
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                                        │
│                                                            │
│  ① Người gửi                                               │
│   Họ tên       [_____________________]                     │
│   SĐT          [_____________] Tỉnh/TP [ dropdown ▾]       │
│   Địa chỉ      [_____________________]                     │
│   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈    │
│  ② Người nhận                                              │
│   Họ tên       [_____________________]                     │
│   SĐT          [_____________] Tỉnh/TP [ dropdown ▾]       │
│   Địa chỉ      [_____________________]                     │
│                                                            │
│                        [← Quay lại]   [Tiếp tục →]          │
└──────────────────────────────────────────────────────────┘
```
Validate ngay khi bấm "Tiếp tục": bắt buộc họ tên, SĐT đúng định dạng
`0xxxxxxxxx`, tỉnh/thành, địa chỉ — báo lỗi đỏ dưới từng field.

## 3. Bước 2/4 "Kiện hàng"

```
  Loại hàng   [ Tài liệu / Quần áo / Điện tử / Thực phẩm / Khác ▾ ]
  Cân nặng(kg)[___]     Dài(cm) [___]
  Rộng(cm)    [___]     Cao(cm) [___]
  Ghi chú     [________________________]
```

## 4. Bước 3/4 "Xác nhận & phí" — gọi API tính phí (pricing engine)

```
  Người gửi: ...            Người nhận: ...
  Kiện hàng: 2kg · 20×15×10cm

  ┌ Phí ship (dashed box, đỏ) ──────────────┐
  │ Dự kiến giao trong 1-3 ngày             │
  │ Phí cơ bản .......... 15.000đ           │
  │ Phí trọng lượng ...... 16.000đ          │
  │ Phí liên tỉnh ........ 20.000đ          │
  │ Tổng phí:  51.000đ  (font lớn, nổi bật) │
  └──────────────────────────────────────────┘
                        [← Quay lại]  [Xác nhận đặt đơn]
```

## 5. Bước 4/4 "Hoàn tất"

```
                    ✅
            Đặt đơn thành công!
        Mã vận đơn: [ PCL1786000000000 ]  ← con dấu đỏ, xoay nhẹ
   Lưu lại mã này để theo dõi hành trình theo thời gian thực.

        [Theo dõi đơn ngay →]   [Xem danh sách đơn]
```

## 6. Màn hình "Đơn của tôi" (`/orders`)

```
┌──────────────────────────────────────────────────────────┐
│ Đơn hàng của tôi                          + Tạo đơn mới    │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐   │
│ │ PCL1786000000000         [ĐÃ GIAO THÀNH CÔNG] (xanh)│   │
│ │ Đến Nguyễn Văn A · TP. Hồ Chí Minh                   │   │
│ │ 20/08/2026 09:14                       (phí nếu có)  │   │
│ └────────────────────────────────────────────────────┘   │
│  (click 1 dòng → /tracking/:code)                          │
│  Trạng thái rỗng: "Bạn chưa tạo đơn hàng nào" + CTA         │
└──────────────────────────────────────────────────────────┘
```
Yêu cầu đăng nhập (JWT, role `customer`). Dữ liệu từ `GET /api/parcels/mine`, tải lại từ server mỗi lần mở trang nên
reload vẫn hiển thị đơn đã lưu. 401 → về `/login`. Phí chỉ hiện khi backend trả `fee` (backend chưa lưu phí vào DB).

## 7. Màn hình "Tra cứu" (`/tracking`, `/tracking/:code`)

```
┌──────────────────────────────────────────────────────────┐
│ Tra cứu vận đơn                                            │
│ [ Nhập mã vận đơn___________________ ] [ Tra cứu ]          │
│                                                            │
│ [ PCL1786000000000 ]          ● Đang theo dõi real-time     │
│ ┌ cảnh báo (khi mất kết nối) ─────────────────────────┐    │
│ │ Mất kết nối real-time — đang tự kết nối lại. Dữ liệu  │    │
│ │ có thể chưa mới nhất (đồng bộ lần cuối lúc hh:mm:ss). │    │
│ └─────────────────────────────────────────────────────┘    │
│ Người nhận: Trần Thị B                                      │
│ ┌ Bản đồ OSM: vị trí tài xế ──────────────────────────┐    │
│ └─────────────────────────────────────────────────────┘    │
│ 📍 Vị trí tài xế: 10.77690, 106.70090 · cập nhật hh:mm:ss    │
│ ● Đã tạo đơn ─────── 20/08 09:14                            │
│ ○ Đang trung chuyển        Chưa tới                          │
└──────────────────────────────────────────────────────────┘
```

Các trạng thái của trang:

| Tình huống | Hiển thị |
|---|---|
| Đang tải | "Đang tải..." |
| Mã không tồn tại (HTTP 404) | Lỗi đỏ: "Không tìm thấy đơn hàng với mã “…”" |
| API lỗi / không kết nối máy chủ | Lỗi đỏ kèm lý do + nút **Thử lại** (không nhầm với "không tìm thấy") |
| Đang kết nối | Badge xanh "Đang theo dõi real-time" |
| Mất kết nối | Badge xám "Mất kết nối" + cảnh báo vàng + giờ đồng bộ cuối; vẫn giữ vị trí gần nhất đã nhận ("có thể đã cũ") |
| Kết nối lại | Tự `join:parcel` lại và tải lại snapshot REST để bù event bị rớt |
| Đơn đã kết thúc | Badge "Đơn đã kết thúc", không mở socket, không hiện bản đồ |

Một trang chỉ dùng **một** socket cho cả trạng thái và vị trí. Vị trí hiển thị là vị trí nhận được trong phiên xem;
backend chưa lưu vị trí gần nhất và chưa gắn nhãn nguồn GPS thật/giả lập (xem `Frontend/README.md` mục 6).

## 8. Màn hình tài xế (`/driver/login`, `/driver`) — role `shipper`

```
┌──────────────────────────────────────────────────────────┐
│ Đơn được giao                         [Làm mới] [Đăng xuất] │
│ ☑ Chia sẻ vị trí cho khách khi đang giao · GPS giả lập · gửi lúc hh:mm:ss
│   (⚠ mất kết nối máy chủ, tạm dừng gửi vị trí)               │
│ ┌────────────────────────────────────────────────────┐   │
│ │ PCL1786...            [CHỜ LẤY HÀNG]                 │   │
│ │ Giao đến Nguyễn Văn A · 09xxxxxxxx · địa chỉ · 1.5 kg │   │
│ │ [Đã lấy hàng]                                        │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```
Chỉ hiện nút mà actor `shipper` được phép ở đúng trạng thái (xem bảng trong `Frontend/README.md` mục 3); trạng thái khác hiện lý do chờ.
"Giao thành công" khóa tới khi tick "đã có bằng chứng giao hàng". Danh sách tự làm mới 15 giây; phiên lưu ở `localStorage`.
Nguồn GPS ("GPS thiết bị" khi trình duyệt cấp quyền, "GPS giả lập" khi không) hiển thị cho tài xế.

## 9. Màn hình vận hành (`/ops/login`, `/ops`) — role `admin`, `warehouse_staff`

```
┌──────────────────────────────────────────────────────────┐
│ Vận hành đơn hàng        Tên · Quản trị / điều phối  [Làm mới][Đăng xuất]
│ [ Tìm theo mã, tên hoặc SĐT người nhận ] [ Mọi trạng thái ▾ ]
│ ┌────────────────────────────────────────────────────┐   │
│ │ PCL1786...  (link → tracking)       [ĐÃ TẠO ĐƠN]     │   │
│ │ Người nhận · SĐT · địa chỉ · khối lượng · ngày tạo    │   │
│ │ Điểm lấy hàng: [Tỉnh ▾] [vĩ độ] [kinh độ]              │   │
│ │ [Gán tài xế gần nhất]                                 │   │
│ └────────────────────────────────────────────────────┘   │
│ ┌ AT_HUB ────────────────────────────────────────────┐   │
│ │ warehouse_staff: [Chuyển sang hub tiếp theo]  ·  admin: [Điều phối giao chặng cuối]
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```
Tìm/lọc phía client trên `GET /api/parcels`. Thao tác theo trạng thái và role như bảng ở `Frontend/README.md`:
`admin` gán tài xế ở `CREATED`; `warehouse_staff` tiếp nhận tại hub (`IN_TRANSIT`, phải tick "đã quét mã tại hub") và
chuyển hub tiếp theo (`AT_HUB`). `admin` (kiêm điều phối theo D01) có nút "Điều phối giao chặng cuối"; backend sẽ chấp nhận sau khi M3 thêm `admin` vào `allowedActors` (hiện trả 403 và UI hiển thị nguyên văn lỗi).
Sau mỗi thao tác UI tải lại danh sách từ server thay vì tự suy ra trạng thái. Màn hình này không có mock.

## 10. Điểm nối với các module khác

- **M2 (API/WebSocket):** REST và event như bảng ở `Frontend/README.md` mục 4. Payload `parcel.status.updated` là *bản vá*
  `{ trackingCode, currentStatus, event }` (đúng code `TrackingGateway`); `docs/INTEGRATION.md` mô tả dạng khác — cần chốt.
- **M3 (state machine/auth):** `VALID_TRANSITIONS` và `SHIPPER_ACTIONS`/`OPS_ACTIONS` ở Frontend phải khớp `transition-table.ts`;
  backend vẫn là nơi kiểm tra cuối cùng (400 sai luồng, 403 sai role hiển thị nguyên văn trên UI).
- **M4 (QA):** `npm test` chạy với mock fetch/socket; E2E thật cần backend + PostgreSQL.
