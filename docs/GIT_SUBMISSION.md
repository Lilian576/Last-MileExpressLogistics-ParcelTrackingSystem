# Hồ sơ bàn giao M3 cuối kỳ

Bản ngày 25/11/2026 của ThaoVy26, theo kế hoạch D01–D03. Hồ sơ cập nhật trạng thái tích hợp backend, contract và bằng chứng CI trên develop. Kết quả demo Q03 và SHA/tag release cuối vẫn chờ nhóm xác nhận.

## 1. Phiên bản và nguồn truy vết

| Thành phần | Mốc |
|---|---|
| Main nền dùng kiểm thử M3 ban đầu | 8b61f2584094c8dbb7292005108e54023d90d10a |
| Develop tích hợp được đối chiếu | a230451dd7bed1d76c200b6106d35b4d73e968a2, sau PR #34 |
| Nhánh sửa backend M2 được tham chiếu | ec57bc3269756a8a23f445ce047c261f122470a3 |
| Bản M3 ban đầu | db557b71c1f67096029a2412f1cff4a1e60873de trên feature/m3-final-revision |
| Contract đã tích hợp vào main | PR #40, merge c83f085fbb81983b4edeffef15fc663c4c73102d |
| Nhánh cập nhật bằng chứng bàn giao | docs/m3-submission-evidence |
| Bản release cuối | Chờ R02 sau khi Q03 hoàn tất |

SHA chính xác của bản đang xem lấy bằng git rev-parse HEAD. CI được dẫn bên dưới thuộc develop a230451. Các kết quả local ở mục 3 là kiểm chứng lịch sử của bản M3 ban đầu. Nhánh tài liệu hiện tại có SHA riêng, chưa được coi là tag release do M2 đóng băng.

Lịch sử PR liên quan gồm #26 sửa Auth/M3, #25 và #28 nối UI thật, #29 sửa token GPS của M1, #27 QA/DevOps trên develop. Phần tích hợp tiếp theo đã merge vào develop qua PR #31, #34 và #35, được dẫn trong bảng dưới. Bằng chứng CI được gắn chính xác với develop a230451, chưa thay thế kết quả demo hai màn hình Q03.

- [Repository](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem)
- [Nhánh M3](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/tree/feature/m3-final-revision)
- [PR M3 trước đây](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/26)
- [PR QA/DevOps](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/27)
- [GitHub Actions](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/actions)
- [User Story và bản thảo issue](issues/README.md)

### Các PR tích hợp đã merge vào develop

| PR | Nội dung và mốc merge |
|---|---|
| [#31 — M2 hoàn thiện luồng giao hàng và tracking](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/31) | Tích hợp lifecycle, quyền API/GPS, lưu dữ liệu và notifier/webhook; merge 196d8da0d81a4d40cb3ccfb2e635be567a371db0 |
| [#34 — Đồng bộ vận hành và tracking với API](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/34) | Chọn hub, contract gán/nhận tại hub và tracking; merge a230451dd7bed1d76c200b6106d35b4d73e968a2 |
| [#35 — Sửa actor nhập hub trong E2E](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/pull/35) | Dùng warehouse_staff cho arrive_at_hub trong kiểm thử; merge 74bdecd0710253a43a0cfb86835f1202e2b686eb |

### CI trên develop

[LastMile CI — run 45602074996](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/actions/runs/45602074996) được kích hoạt bởi push develop ngày 25/11/2026 lúc 18:11:18 (Asia/Bangkok), SHA a230451dd7bed1d76c200b6106d35b4d73e968a2. Run hoàn tất với kết quả success, cả hai job đều đạt.

| Job | Các bước đã đạt | Link bằng chứng |
|---|---|---|
| Backend | PostgreSQL service, npm ci, lint, Prisma generate/migrate/seed, unit coverage, build, khởi động API, test:e2e và test:api (Playwright API) | [Job backend 139163259144](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/actions/runs/45602074996/job/139163259144) |
| Frontend | npm ci, lint, test và build | [Job frontend 139163259620](https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem/actions/runs/45602074996/job/139163259620) |

Workflow tại mốc này dùng Node 20 cho backend, Node 22 cho frontend và PostgreSQL 16 trong CI. Kết quả success của test:cov không được dùng để tự suy ra tỷ lệ coverage cụ thể nếu chưa trích báo cáo. CI có E2E/Playwright API chạy thành công, còn kết quả thao tác UI hai màn hình, Docker Compose từ checkout sạch, độ trễ và ảnh/video do Liêm cung cấp sẽ được ghi theo Q03.

## 2. Đóng góp trong lần sửa

| Mã | Nội dung đã chuẩn bị | Trạng thái bàn giao |
|---|---|---|
| D01 | Admin dispatch_last_mile, seed đủ bốn role, bảy cột nullable cho phí/tọa độ/xác nhận giao | Build, unit và kiểm tra PostgreSQL cục bộ đạt |
| D01 | Giữ migration cũ, dữ liệu thiếu trường là NULL, seed không ghi đè tài khoản/hub | Thử DB rỗng, DB cũ và seed lại đạt |
| D02 | SRS, ma trận actor/event, REST/socket/assignment, OpenAPI 3.1 và contract webhook | Đã đồng bộ controller/DTO/service trên develop a230451; chờ review tài liệu |
| D02 | PDF Use Case, Class, Sequence và ERD cùng nguồn | Đã render và kiểm tra trực quan |
| D03 | Hồ sơ chức năng, thiết kế, test, truy vết và giới hạn | Bản bàn giao đã có, chờ Q03/R02 để chốt release |

M2 đã tích hợp API lifecycle, ghi phí/tọa độ và deliveryProofRef, quyền GET/GPS, side effect assignment và webhook trên develop qua PR #31 và #34. onTransition hiện nhận thêm notification={id,update} ở tham số thứ năm để phát đúng history đã commit. OpenAPI, INTEGRATION và SRS đã đồng bộ theo develop a230451. Việc xác minh đầy đủ qua UI, chất lượng bằng chứng giao và giới hạn retry/outbox còn phải theo kết quả nghiệm thu thực tế.

## 3. Kết quả kiểm chứng local của bản M3 ban đầu ngày 25/11/2026

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

Bản OpenAPI đồng bộ theo develop đã qua Redocly lint cả schema và ví dụ request. Còn cảnh báo địa chỉ localhost cho môi trường demo. Kiểm tra trực tiếp ParcelNotifierService với receiver giả xác nhận payload/header/HMAC khớp tài liệu và lỗi receiver không làm reject notification.

Bộ npm hiện báo các lỗ hổng dependency có sẵn trong lockfile. Lần sửa M3 giữ dependency hiện hành. Q02 cần rà dependency trước triển khai thật. Kết quả 51 test là unit/integration giả DB sẵn có cộng test quyền M3. Các kiểm tra PostgreSQL local trên là migrate/seed/auth và lưu trường. CI E2E và Playwright API của develop đã chạy thành công như bằng chứng ở mục 1. Kết quả local cũ không thay thế kết quả của CI này hoặc Q03.

## 4. Cách kiểm tra lại và demo phần M3

Trong backend, cấu hình DATABASE_URL trỏ DB demo riêng, JWT_SECRET riêng và DEMO_SEED_PASSWORD theo INTEGRATION.md. Thực hiện npm ci, npx prisma migrate deploy, npx prisma generate, npx prisma db seed, npm run build và npm test -- --runInBand. Khởi động backend bằng npm run start:dev.

Dùng customer@example.test, warehouse@example.test, admin@example.test, shipper1@example.test, shipper2@example.test để kiểm login, mật khẩu theo DEMO_SEED_PASSWORD lúc seed tạo tài khoản. Seed lại không reset mật khẩu.

Backend trên develop đã tích hợp B01. API create lưu feeVnd và tọa độ. Admin chọn destinationHubId khi gán tài xế, kho gửi hubId khi arrive_at_hub, tài xế gửi deliveryProofRef khi confirm_delivery. API lưu chuỗi tham chiếu đã trim vào deliveryProof; hiện chưa kiểm nội dung ảnh/chữ ký/OTP. Đọc INTEGRATION.md và OpenAPI để demo theo payload hiện tại. Dùng kết quả Q03 để xác nhận trải nghiệm trọn luồng qua UI.

## 5. Trạng thái tích hợp và tiêu chí cần chốt trước bảo vệ

| Phụ thuộc | Việc cần xác nhận |
|---|---|
| R01 / M2 | Đồng bộ develop với main, issue có assignee, PR review độc lập và ruleset |
| B01 / M2 | Đã tích hợp qua PR #31 và #34, có CI E2E/Playwright xanh trên a230451; chờ đối chiếu kết quả demo Q03 |
| B02 / M2 | Quyền GET/GPS, snapshot vị trí và notifier đã tích hợp trên develop; kiểm các tình huống UI/reconnect trong Q03 |
| B03 / M2 | Đã có webhook HMAC, timeout 2000 ms và log lỗi receiver; hiện gửi một lần, chưa retry/outbox; bổ sung bằng chứng Q03 nếu có |
| F01–F02 / M1 | Contract hub/tracking đã tích hợp qua PR #34; chờ demo với Liêm xác nhận thao tác thực tế |
| Q01–Q03 / M4 | CI develop a230451 đã chạy E2E và Playwright API thành công; chờ báo cáo coverage cụ thể, Compose sạch, demo hai màn hình và ảnh/video |
| D03 / M3 | Nhận kết quả Q03, thay mốc release và bổ sung PR/CI/video của đúng SHA |
| R02 / M2 | Đóng băng source sau khi checklist đạt |

GPS frontend có thể lấy từ trình duyệt hoặc mô phỏng khi không lấy được vị trí. Bản bàn giao chưa có bằng chứng GPS thiết bị thật. Không gắn kết quả giả lập với lời khẳng định GPS thực tế hoặc bảo đảm dưới 1 giây. M4 ghi nguồn GPS và số đo nhiều lượt trong Q03.

Develop a230451 đã có CI E2E/Playwright API xanh theo run 45602074996. Workflow hiện chạy khi push main/develop và các nhánh feature/**, feat/**, fix/**, test/**, hoặc PR vào main/develop. Nhánh docs/** có CI thông qua PR. Khi Liêm gửi kết quả nghiệm thu và người phụ trách chốt SHA/tag release, cập nhật mục phiên bản cùng link CI, log Compose và ảnh/video của đúng bản nộp. Hiện chưa có kết quả Q03 và SHA/tag release cuối để gắn các minh chứng đó.
