# SRS cuối kỳ LẹMail

Bản bàn giao M3 ngày 25/11/2026 cho D01–D03. Mốc code đối chiếu main 8b61f25. Nhánh tích hợp phải qua review và nghiệm thu Q03 trước khi xác lập release. Tài liệu mô tả yêu cầu, hành vi thực có và các khoảng trống được giao rõ người phụ trách.

## 1. Phạm vi

Last-Mile Express Logistics & Parcel Tracking System phục vụ tạo đơn, báo phí, lấy hàng, trung chuyển hub, giao chặng cuối và tracking. MVP dùng admin kiêm điều phối. Có mô hình cho giao lại, hoàn trả, hủy và thất lạc nhưng không mặc định các nhánh đó đã được nghiệm thu. Ngoài phạm vi gồm thanh toán ngân hàng, SMS/email, CRUD tài khoản đầy đủ, tối ưu nhiều tuyến và microservice.

Frontend React/TypeScript gọi REST/Socket.IO của NestJS. PostgreSQL và Prisma lưu dữ liệu. JWT/Passport và RolesGuard cung cấp danh tính và quyền. Quyền sở hữu đơn và assignment phải được service kiểm từ DB.

## 2. Chức năng và truy vết

User Story và Gherkin gốc tại m3.md mục 1, bản thảo issue tại issues/US-01.md đến US-09.md. Kế hoạch cuối kỳ giao R01 tạo issue/board cho M2. Không đánh dấu bản thảo là issue đã tạo.

| Yêu cầu | Story | Kết quả cần đạt | Phần triển khai / kiểm chứng |
|---|---|---|---|
| FR-01 Tạo đơn | US-01 | CREATED, mã duy nhất, phí và tọa độ lưu DB, history ban đầu | B01/F01; D01 đã chuẩn bị cột nullable |
| FR-02 Gán pickup | US-02 | Admin gán shipper rảnh gần nhất, PENDING_PICKUP | Có transaction gán trên main, B01/B02 còn chốt quyền và emit |
| FR-03 Lấy hàng | US-03 | Đúng shipper xác nhận, assignment in_progress | B01/B02 phải suy guard từ DB |
| FR-04 Qua hub và last mile | US-04 | IN_TRANSIT → AT_HUB → OUT_FOR_DELIVERY | D01 cho admin dispatch_last_mile, B01 sở hữu side effect |
| FR-05 Giao thành công | US-05 | Bằng chứng đã kiểm tra, DELIVERED, assignment completed | D01 có deliveryProof/deliveredAt, API B01 chưa lưu |
| FR-06 Giao lại | US-06 | Lưu lý do, tăng số lần, retry dưới ngưỡng 3 | Guard có, job và assignment cần B01 |
| FR-07 Hoàn trả | US-07 | RETURNING → RETURNED, đóng assignment | Guard có, chưa có AssignmentType return |
| FR-08 Hủy | US-08 | Chủ đơn hủy trước lấy hàng, đóng assignment | State machine có, quyền đối tượng/side effect cần B01/B02 |
| FR-09 Thất lạc | US-09 | >72 giờ ở IN_TRANSIT/AT_HUB → LOST | Guard có, job SLA/ticket còn thiếu |
| FR-10 Tracking | US-01–09 | Mã tracking, timeline, socket theo room | Main có REST và event raw status, F02/B02 bổ sung GPS snapshot |
| FR-11 Auth | TEAM tuần 2 | Register chỉ customer, login JWT, phân quyền theo DB | Auth có, kiểm quyền đối tượng/GPS thuộc B02 |
| FR-12 Sự kiện | TEAM tuần 4 | Sau commit, không phát khi rollback | Main emit sau updateStatus, B02 nối hook cho toàn bộ đường ghi |
| FR-13 Pricing | TEAM tuần 2 | VND nhất quán, reload lấy phí đã lưu | Công thức có; B01 ghi feeVnd |
| FR-14 Webhook | Topic 4 / B03 | POST có ký sau commit, lỗi receiver không sửa trạng thái | D02 có OpenAPI/contract, sender do M2 triển khai |

## 3. Quyền và trạng thái

Schema có bốn Role gồm customer, shipper, warehouse_staff, admin. Admin được assign_courier và dispatch_last_mile. Dispatcher là tên nghiệp vụ/actor legacy, không đăng ký được. System là actor dành riêng job nội bộ. Không nâng admin thành mọi vai trò kho/tài xế.

Bảng actor/event đủ 16 transition và guard trong m3.md mục 2.2, khớp transition-table.ts. DELIVERED, RETURNED, CANCELLED, LOST là terminal. Không dùng cờ hasDeliveryProof, isAssignedCourier, isFinalHub do client gửi làm bằng chứng tin cậy.

Status, history, failedAttemptCount và assignment phải cùng transaction. Cập nhật đồng thời cần kiểm trạng thái cũ hoặc Serializable và xử lý conflict 409. Chỉ emit sau commit. M3 cung cấp guard thuần, M2 ghi persistence và side effect. Chỉ mục tọa độ là B-tree quan hệ. Haversine hiện tính trong ứng dụng, chưa có PostGIS.

## 4. Mô hình dữ liệu

ERD trong m3.md và uml/erd.puml phản ánh User, Parcel, ParcelStatusHistory, Location, DeliveryAssignment. Migration cũ được giữ nguyên. Migration mới thêm feeVnd, senderLat/Lng, receiverLat/Lng, deliveryProof, deliveredAt dưới dạng nullable.

Dữ liệu cũ thiếu trường vẫn đọc được với giá trị null. Không backfill số 0 hoặc giả bằng chứng giao cho đơn DELIVERED cũ. Không tự tính lại phí đơn cũ. API mới B01 phải ghi trường khi có dữ liệu hợp lệ. Quy tắc assignment và bằng chứng tối thiểu tại INTEGRATION.md.

Seed có admin, warehouse_staff, customer, hai shipper có tọa độ và hai hub, chạy lại giữ dữ liệu có sẵn. Không có tài khoản system/dispatcher và không có mật khẩu mặc định trong Git.

## 5. API và thời gian thực

OpenAPI 3.1 tại openapi-spec.yaml mô tả các route thực có, lỗi và schema. Các operation ghi rõ lỗ hổng hiện tại thay vì gán security chưa có trong controller. Route đang có gồm auth/register, auth/login, calculate-fee, tạo/liệt kê/chi tiết parcel, mine, assigned/mine, public tracking, assign-courier và status.

Payload socket đang chạy gồm trackingCode, currentStatus, event.status/timestamp. M1 cần giữ adapter tương thích. Mapping nhãn Received/In-Transit trong m3.md là yêu cầu trình bày, chưa phải wire API. Public tracking main còn receiverName và raw status, việc tối thiểu hóa thông tin và không lộ lý do nhạy cảm còn thuộc B02.

HTTP webhook là contract B03 dự kiến tại top-level webhooks trong OpenAPI. Chưa có sender HTTP trên main. Chữ ký, event ID, timeout và lỗi receiver được quy định trong INTEGRATION.md. Không dùng Socket.IO để đánh dấu webhook HTTP hoàn tất.

## 6. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Bằng chứng cần có |
|---|---|---|
| NFR-01 | HTTP rate limit 120/60s, auth 10/60s, Retry-After | Unit/integration rate-limit tests |
| NFR-02 | Hash mật khẩu, JWT secret riêng, quyền đối tượng và GPS từ DB | Auth tests và Q01 permission matrix |
| NFR-03 | UI nhận trạng thái/GPS dưới 1 giây, reconnect resync | Q03 đo nhiều lượt trên cùng SHA |
| NFR-04 | Status/history/assignment cùng commit, rollback không event | Q01 PostgreSQL integration |
| NFR-05 | 16 transition đúng actor/guard, ≥10 test state machine | Unit test và CI |
| NFR-06 | Migration DB rỗng và DB cũ, seed chạy lại an toàn | D01 thử nghiệm DB cô lập |
| NFR-07 | CI build hai phía, coverage ≥60%, Playwright API/E2E | Q02 và link CI trên commit nộp |
| NFR-08 | Webhook thành công/lỗi receiver đúng contract | B03/Q01 receiver test |
| NFR-09 | Hướng dẫn demo và tài liệu cùng release | D03/R02 SHA và Q03 checklist |

HTTP limiter hiện nằm trong bộ nhớ một process, chưa giới hạn WebSocket. Các số đo cục bộ cũ và CI trên SHA khác chỉ là bằng chứng lịch sử. Ghi kết quả hiện có và mục chưa nghiệm thu trong GIT_SUBMISSION.md.
