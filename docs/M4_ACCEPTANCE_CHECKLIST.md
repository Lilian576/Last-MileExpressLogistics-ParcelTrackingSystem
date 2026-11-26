# M4 - Checklist nghiệm thu

**Cập nhật:** 2026-11-26 18:21 +07:00  
**Tóm tắt:** Q01/Q02 có CI và Compose evidence xanh trên SHA ứng viên bên dưới. Q03 đã xác nhận luồng giao hàng trên ứng viên; reconnect sau bản sửa mới nhất vẫn chưa xác minh.

## SHA và CI

- **SHA ứng viên đã nghiệm thu:** `9b2603aa8fb9e08db3d5f355beefe41bb9ed3d9a`.
- **CI:** [Run #115](https://github.com/Lilian576/Last-MileExpressLogistics/actions/runs/45773545059) xanh trên SHA ứng viên.
- **CI tests/coverage:** backend 57/57 unit tests, line coverage 75.09%; Jest E2E 5 tests và Playwright API 2 tests đạt. Frontend lint, test, build và backend build đạt.
- **Compose:** `docker compose up --build -d` thành công; PostgreSQL healthy, 5 migration và seed thành công, API trả HTTP 200.
- **Bằng chứng:** [Compose log](./evidence/q03-compose-9b2603a.log), [DB verification](./evidence/q03-db-verification-9b2603a.log).

## Q03 — Kết quả hiện tại

### Đã xác nhận trên SHA ứng viên

- Luồng UI từ tạo đơn đến `DELIVERED` đạt. DB xác nhận trạng thái cuối `DELIVERED`, pickup/last-mile assignment hoàn tất và lịch sử đủ 7 trạng thái.
- Khách nhận thay đổi trạng thái không cần F5. Năm lượt đo quan sát được: **100, 101, 180, 105, 213 ms**; đây là số đo gần đúng, không phải phép đo click-to-paint chuyên dụng.
- Ảnh: [khách DELIVERED](./evidence/q03-customer-delivered.png), [tài xế DELIVERED](./evidence/q03-driver-delivered.png), [ops DELIVERED](./evidence/q03-ops-delivered.png).

### Reconnect sau bản sửa GPS — CHƯA XÁC MINH

- **Đơn kiểm tra:** `PCL19443f19944ab74cbac02dc02249d44f`, `OUT_FOR_DELIVERY`; tài xế Demo Shipper 2, chia sẻ vị trí bật.
- **Lượt gần nhất:** khoảng 18:13 +07. UI tài xế ghi `GPS thiết bị`, mốc gửi tăng từ 18:13:31 lên 18:13:51. Tab khách vẫn báo mất kết nối, giữ vị trí cũ `10.78123, 106.70568` (16:16:07).
- DevTools của tab khách hiển thị `Disabled: No throttling`, nhưng request vẫn lỗi `net::ERR_INTERNET_DISCONNECTED` / `TypeError: Failed to fetch`. Không F5 và không bấm giao thành công.
- Không xác nhận được khách tự đồng bộ vị trí bị lỡ hoặc nhận tick mới. Chưa thể kết luận lỗi thuộc ứng dụng vì mạng của tab chưa hoạt động trở lại.
- GPS phần cứng thật **chưa xác minh**; nhãn “GPS thiết bị” trên UI không tự chứng minh nguồn GPS vật lý.

### Bản sửa và giới hạn

- Đã sửa frontend để ánh xạ GPS từ tracking snapshot, đồng bộ snapshot sau khi server ACK vào room, bỏ qua tọa độ cũ và chỉ báo realtime sau khi join room thành công.
- Kiểm tra tự động trên source đã sửa: frontend tracking/reconnect **16/16**, lint/build đạt; backend `parcels.service.spec.ts` **15/15**, build đạt.
- Các thay đổi source chưa commit; SHA frontend đang phục vụ tại `localhost:5174` chưa xác minh. Vì vậy chưa thể khẳng định lượt UI reconnect chạy bản sửa.
- **Kết luận Q03:** luồng giao hàng tới `DELIVERED` đã đạt trên SHA ứng viên; reconnect sau bản sửa và GPS phần cứng còn mở. Không đánh dấu nghiệm thu Q03 hoàn tất.

## Việc còn lại

Khởi động frontend từ checkout chứa bản sửa với `VITE_USE_MOCK=false`, xác nhận runtime SHA/cấu hình, rồi chạy lại trên cùng tab khách: Offline → tài xế gửi GPS → `Disabled: No throttling`, không F5. Chỉ chốt reconnect PASS khi khách tự hiển thị vị trí mới nhất sau reconnect và tiếp tục nhận tick mới; lưu SHA cùng ảnh/clip của lượt đó.
