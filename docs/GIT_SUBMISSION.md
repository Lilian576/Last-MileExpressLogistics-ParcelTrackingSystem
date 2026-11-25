# Hồ sơ bàn giao M3 cuối kỳ

Bản ngày 25/11/2026 của ThaoVy26, theo kế hoạch D01–D03. Mục tiêu bản bàn giao là chuẩn bị dữ liệu, quyền state machine và tài liệu để M2/M1/M4 tích hợp ứng viên nộp.

## 1. Phiên bản và nguồn truy vết

| Thành phần | Mốc |
|---|---|
| Main dùng để thực hiện và kiểm thử M3 | 8b61f2584094c8dbb7292005108e54023d90d10a |
| Develop được đối chiếu | 5f2d7b030ec43361f683d17a1fc373cd598deecc |
| Nhánh sửa backend M2 được tham chiếu | ec57bc3269756a8a23f445ce047c261f122470a3 |
| Bản bàn giao M3 | feature/m3-final-revision, commit có tiêu đề “sửa lại” |
| Bản release cuối | Chờ R02 sau khi Q03 hoàn tất |

SHA chính xác của bản đang xem lấy bằng git rev-parse HEAD. Mỗi file trong cây commit, gồm nguồn/PDF UML và OpenAPI, thuộc cùng bản bàn giao. Tài liệu này chưa gán một SHA release giả khi M2 chưa đóng băng.

Lịch sử PR liên quan gồm #26 sửa Auth/M3, #25 và #28 nối UI thật, #29 sửa token GPS của M1, #27 QA/DevOps trên develop. Danh sách này dùng để truy vết phần nền. Kết quả review, CI hay nghiệm thu của PR cũ không được suy ra thành kết quả của bản nộp mới.

- [Repository](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem)
- [Nhánh M3](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/tree/feature/m3-final-revision)
- [PR M3 trước đây](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/26)
- [PR QA/DevOps](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/27)
- [GitHub Actions](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/actions)
- [User Story và bản thảo issue](issues/README.md)

## 2. Đóng góp trong lần sửa

| Mã | Nội dung đã chuẩn bị | Trạng thái bàn giao |
|---|---|---|
| D01 | Admin dispatch_last_mile, seed đủ bốn role, bảy cột nullable cho phí/tọa độ/xác nhận giao | Build, unit và kiểm tra PostgreSQL cục bộ đạt |
| D01 | Giữ migration cũ, dữ liệu thiếu trường là NULL, seed không ghi đè tài khoản/hub | Thử DB rỗng, DB cũ và seed lại đạt |
| D02 | SRS, ma trận actor/event, REST/socket/assignment, OpenAPI 3.1 và contract webhook | Đã đối chiếu controller và DTO ở main, chờ M1/M2 review |
| D02 | PDF Use Case, Class, Sequence và ERD cùng nguồn | Đã render và kiểm tra trực quan |
| D03 | Hồ sơ chức năng, thiết kế, test, truy vết và giới hạn | Bản bàn giao đã có, chờ Q03/R02 để chốt release |

M3 giữ interface onTransition bốn tham số, đồng bộ kiểu payload với gateway và frontend đang dùng. M2 sở hữu việc cài notifier, API lifecycle, ghi các cột mới, xác thực GPS, side effect assignment và gửi webhook. Tài liệu phân biệt phần có trên main với hợp đồng cần tích hợp.

## 3. Kết quả kiểm chứng tại máy ngày 25/11/2026

Môi trường gồm Windows, Node 24.19.0, Prisma 5.22.0 và PostgreSQL 18. DB thử nghiệm được tạo riêng trên localhost, không dùng dữ liệu triển khai.

| Kiểm tra | Kết quả |
|---|---|
| npm ci theo package-lock | Thành công |
| prisma generate và prisma validate | Thành công |
| npm run build | Thành công |
| Unit test backend | 9 suite, 51 test pass |
| Kiểm quyền mới | Admin điều phối last mile tại hub cuối được chấp nhận, hub trung gian bị từ chối |
| Kiểm sai actor | Customer, shipper và warehouse_staff không được dispatch_last_mile |
| Integrity transition table | Đủ 16 cặp from/event, không trùng |
| DB rỗng | Áp dụng đầy đủ 4 migration thành công, deploy lại không có migration chờ |
| DB có dữ liệu cũ | Tạo theo 3 migration cũ, chèn parcel DELIVERED, áp dụng migration mới thành công |
| Dữ liệu cũ sau nâng cấp | Giữ nguyên trạng thái và địa chỉ, bảy cột mới vẫn NULL |
| Seed trên hai DB | Năm tài khoản, đủ bốn role, hai hub |
| Seed chạy lại | User, password hash, tọa độ, timestamps và hub không bị thay đổi |
| Ghi/đọc trường mới qua Prisma | Phí, tọa độ, deliveryProof và deliveredAt đọc lại đúng |
| Auth qua HTTP với PostgreSQL | Đăng nhập thành công năm tài khoản seeded, role đúng |
| Tự đăng ký role admin qua HTTP | Response vẫn có user.role=customer |
| OpenAPI 3.1 | Redocly lint kiểm cấu trúc và refs, chi tiết cảnh báo bên dưới |
| PDF UML | Bốn file hợp lệ, mỗi file một trang, đã render lại để kiểm tra |

OpenAPI dùng localhost cho môi trường demo và có schema location dùng riêng trong phần mở rộng Socket.IO. Redocly có thể cảnh báo địa chỉ local và component chỉ được tham chiếu qua extension. Các cảnh báo đó không được tính thành lỗi schema.

Bộ npm hiện báo các lỗ hổng dependency có sẵn trong lockfile. Lần sửa M3 giữ dependency hiện hành. Q02 cần rà dependency trước triển khai thật. Kết quả 51 test là unit/integration giả DB sẵn có cộng test quyền M3. Các kiểm tra PostgreSQL trên là migrate/seed/auth và lưu trường, chưa phải E2E giao trọn vòng đời.

## 4. Cách kiểm tra lại và demo phần M3

Trong backend, cấu hình DATABASE_URL trỏ DB demo riêng, JWT_SECRET riêng và DEMO_SEED_PASSWORD theo INTEGRATION.md. Thực hiện npm ci, npx prisma migrate deploy, npx prisma generate, npx prisma db seed, npm run build và npm test -- --runInBand. Khởi động backend bằng npm run start:dev.

Dùng customer@example.test, warehouse@example.test, admin@example.test, shipper1@example.test, shipper2@example.test để kiểm login, mật khẩu theo DEMO_SEED_PASSWORD lúc seed tạo tài khoản. Seed lại không reset mật khẩu.

Đọc ma trận event ở m3.md để M4 xây fixture cho luồng lấy hàng, kho và điều phối. Các cột feeVnd/tọa độ/bằng chứng đã sẵn sàng trong PostgreSQL. Việc API create/status ghi các cột đó cần B01 tích hợp trước khi demo đầy đủ qua UI.

## 5. Tiêu chí còn mở trước bảo vệ

| Phụ thuộc | Việc cần xác nhận |
|---|---|
| R01 / M2 | Đồng bộ develop với main, issue có assignee, PR review độc lập và ruleset |
| B01 / M2 | Lifecycle tới DELIVERED, assignment đóng/mở đúng, lưu phí/tọa độ/bằng chứng qua API |
| B02 / M2 | Quyền GET và GPS theo DB, lưu vị trí mới nhất, notifier sau commit ở mọi đường ghi |
| B03 / M2 | HTTP webhook có ký, timeout và xử lý lỗi receiver theo OpenAPI |
| F01–F02 / M1 | UI nhân sự, dữ liệu phí/bằng chứng, reconnect và GPS snapshot |
| Q01–Q03 / M4 | PostgreSQL delivery E2E, Playwright API, coverage, Compose và nghiệm thu hai màn hình |
| D03 / M3 | Nhận kết quả Q03, thay mốc release và bổ sung PR/CI/video của đúng SHA |
| R02 / M2 | Đóng băng source sau khi checklist đạt |

GPS frontend có thể lấy từ trình duyệt hoặc mô phỏng khi không lấy được vị trí. Bản bàn giao chưa có bằng chứng GPS thiết bị thật. Không gắn kết quả giả lập với lời khẳng định GPS thực tế hoặc bảo đảm dưới 1 giây. M4 ghi nguồn GPS và số đo nhiều lượt trong Q03.

Bản này chưa có CI E2E/Playwright và kết quả Q03 cho release mới. CI trên nhánh feature không tự chạy vì workflow hiện chỉ trigger push vào main/develop hoặc PR nhắm hai nhánh đó. M2 đồng bộ develop trước khi mở PR tích hợp theo TEAM.md để tránh đưa chênh lệch cả frontend/DevOps vào PR riêng M3.
