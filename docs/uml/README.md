# Sơ đồ bàn giao cuối kỳ

Bản M3 ngày 25/11/2026. Nguồn PlantUML và PDF đi theo cặp trong cùng commit.

| Sơ đồ | Nguồn | Bản xem |
|---|---|---|
| Use Case | [use-case.puml](use-case.puml) | [use-case.pdf](use-case.pdf) |
| Class | [class.puml](class.puml) | [class.pdf](class.pdf) |
| Sequence | [sequence.puml](sequence.puml) | [sequence.pdf](sequence.pdf) |
| ERD | [erd.puml](erd.puml) | [erd.pdf](erd.pdf) |

Use Case mô tả phạm vi nghiệp vụ và admin kiêm điều phối. Class và ERD thể hiện cột D01 nullable cùng quan hệ Prisma. Sequence mô tả đường updateStatus trên main 8b61f25, ghi rõ điểm B02/B03 còn cần tích hợp.

PDF dùng khổ theo tỷ lệ sơ đồ để giữ cỡ chữ khi xem 100%. Bản nguồn render bằng PlantUML với dpi 150, ảnh được đóng gói PDF và đã render lại bằng Poppler để kiểm tra nội dung, nhãn và cạnh trang. Không dùng PDF này làm bằng chứng luồng nghiệp vụ đã chạy.

Khi M2 tích hợp B01–B03, cần cập nhật phần hiện trạng trong Sequence và xuất lại PDF từ cùng nguồn. State machine và 16 transition nằm ở [m3.md](../m3.md), REST/socket/webhook tại [INTEGRATION.md](../INTEGRATION.md) và [OpenAPI](../openapi-spec.yaml).
