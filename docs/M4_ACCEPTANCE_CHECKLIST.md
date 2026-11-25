# M4 - Checklist nghiệm thu

Điền Đạt/Trượt sau khi chạy trên cùng một commit ứng viên.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| SHA/Tag ứng viên | Chưa đóng băng | Chưa có commit/release identifier |
| CI commit hash | Chưa chạy | Cần GitHub Actions của commit ứng viên |
| Checkout sạch | Chưa đủ điều kiện | Cần checkout sạch trong runner CI |
| PostgreSQL migrate + seed | Chưa kiểm tra cục bộ | Workflow CI đã thêm PostgreSQL, migrate và seed |
| Backend build/lint/unit/coverage | Đạt một phần | 45/45 unit pass; build pass; coverage lines 64.15%; lint có sai format code nền |
| Frontend lint/test/build | Đạt | 16/16 test pass; build pass; lint pass |
| Docker Compose build/run | Trượt môi trường | Docker Compose config đã viết; daemon Docker Desktop không sẵn sàng trên máy kiểm thử |
| API/E2E Playwright | Đạt cấu hình, chưa chạy toàn bộ | Test Playwright API đã thêm; cần API + PostgreSQL của commit CI |
| WebSocket room/reconnect | | |
| Luồng trạng thái tới DELIVERED | | |
| Sai actor/transition | | |
| GPS thật/mô phỏng | | |
| Webhook thành công/lỗi receiver | | |
| Thời gian thao tác đến UI (đo nhiều lần) | | |
| Artillery/load-test log | | |
| Video/ảnh nghiệm thu | | |

Chỉ ghi `Đạt` khi có kết quả kiểm tra trên cùng SHA, với link CI, log hoặc file bằng chứng.
