# Wireframe UI — Customer Flow (M1, Tuần 1)

> Ghi chú: bản Figma tương tác nên được nhóm dựng song song trong file Figma
> chung của repo (link đính kèm README). Tài liệu này mô tả wireframe ở dạng
> văn bản/ASCII — dùng làm đặc tả UI trong SRS và đối chiếu 1-1 với UI thật đã
> triển khai trong `src/components/`.

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
   │ timeline             │  │ tôi (localStorage) │
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
│ LẹMail                          [Tạo đơn] [Đơn của tôi] [Tra cứu]
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
        Mã vận đơn: [ LM2026082012345 ]  ← con dấu đỏ, xoay nhẹ
   Lưu lại mã này để theo dõi hành trình theo thời gian thực.

        [Theo dõi đơn ngay →]   [Xem danh sách đơn]
```

## 6. Màn hình "Đơn của tôi" (`/orders`) — Tuần 2

```
┌──────────────────────────────────────────────────────────┐
│ Đơn hàng của tôi                          + Tạo đơn mới    │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐   │
│ │ LM2026082012345          [ĐÃ GIAO THÀNH CÔNG] (xanh)│   │
│ │ Đến Nguyễn Văn A · TP. Hồ Chí Minh                   │   │
│ │ 20/08/2026 09:14                          51.000đ    │   │
│ └────────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────────┐   │
│ │ LM2026081900987              [ĐANG GIAO HÀNG] (vàng)│   │
│ │ Đến Trần Thị B · Hà Nội                              │   │
│ │ 19/08/2026 14:02                          63.000đ    │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│  (click 1 dòng → điều hướng sang /tracking/:code)          │
│  Trạng thái rỗng: "Bạn chưa tạo đơn hàng nào" + CTA         │
└──────────────────────────────────────────────────────────┘
```
Nguồn dữ liệu: `listMyParcels()` trong `src/api/parcelApi.ts`. Ở giai đoạn
chưa có AuthModule (JWT — M3), danh sách được xác định bằng các
`trackingCode` đã tạo trên chính trình duyệt (lưu ở `localStorage`, xem
`src/lib/myOrders.ts`). Khi M3 hoàn thành JWT auth, chỉ cần đổi phần thân hàm
`listMyParcels()` sang gọi `GET /api/parcels/mine` kèm `Authorization`
header — không phải sửa bất kỳ component UI nào.

## 7. Màn hình "Tra cứu" (`/tracking`, `/tracking/:code`)

```
┌──────────────────────────────────────────────────────────┐
│ Tra cứu vận đơn                                            │
│ [ Nhập mã vận đơn___________________ ] [ Tra cứu ]          │
│                                                            │
│ [ LM2026082012345 ]           ● Đang theo dõi real-time     │
│ Từ TP.HCM đến Hà Nội · Người nhận: Trần Thị B               │
│                                                            │
│ ● Đã tạo đơn ─────── 20/08 09:14                            │
│ ● Đã lấy hàng ─────── 20/08 09:18                           │
│ ● Tại trung tâm phân loại  Chưa tới                          │
│ ○ Đang trung chuyển        Chưa tới                          │
│ ○ Đang giao hàng            Chưa tới                          │
│ ○ Đã giao thành công        Chưa tới                          │
└──────────────────────────────────────────────────────────┘
```
Timeline cập nhật tức thời khi nhận sự kiện qua WebSocket (`subscribeToParcel`
trong `parcelApi.ts`), khớp với `TrackingGateway` mà M2 sẽ dựng ở Tuần 4.

## 8. Điểm nối với các module khác (đối chiếu handbook)

- **M2 (pricing/API):** Wizard gọi `getQuote()` / `createParcel()` — format
  request/response đã khớp `QuoteRequest`, `QuoteResponse`, `CreateParcelRequest`
  trong `src/types/parcel.ts`. M2 chỉ cần implement đúng contract này ở NestJS.
- **M3 (state machine):** danh sách trạng thái + bảng transition trong
  `src/types/parcel.ts` (`VALID_TRANSITIONS`) phải khớp 100% với
  `StateMachineService` bên backend.
- **M2 (WebSocket event M2→M1):** `subscribeToParcel()` lắng nghe event
  `parcel.status.updated` / `parcel.delivery.completed`, payload là object
  `Parcel` đầy đủ — cần chốt lại đúng tên event này trong buổi họp M2↔M1.
