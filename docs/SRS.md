# SRS cuối kỳ LẹMail

Bản bàn giao M3 ngày 25/11/2026 cho D01–D03. Mốc code đối chiếu develop a230451 sau PR #34. Nhánh tích hợp phải qua review và nghiệm thu Q03 trước khi xác lập release. Tài liệu mô tả yêu cầu, hành vi thực có và các khoảng trống được giao rõ người phụ trách.

## 1. Phạm vi

Last-Mile Express Logistics & Parcel Tracking System phục vụ tạo đơn, báo phí, lấy hàng, trung chuyển hub, giao chặng cuối và tracking. MVP dùng admin kiêm điều phối. Có mô hình cho giao lại, hoàn trả, hủy và thất lạc nhưng không mặc định các nhánh đó đã được nghiệm thu. Ngoài phạm vi gồm thanh toán ngân hàng, SMS/email, CRUD tài khoản đầy đủ, tối ưu nhiều tuyến và microservice.

Frontend React/TypeScript gọi REST/Socket.IO của NestJS. PostgreSQL và Prisma lưu dữ liệu. JWT/Passport và RolesGuard cung cấp danh tính và quyền. Quyền sở hữu đơn và assignment phải được service kiểm từ DB.

## 2. Chức năng và truy vết

User Story và Gherkin gốc tại m3.md mục 1, bản thảo issue tại issues/US-01.md đến US-09.md. Kế hoạch cuối kỳ giao R01 tạo issue/board cho M2. Không đánh dấu bản thảo là issue đã tạo.

| Yêu cầu | Story | Kết quả cần đạt | Phần triển khai / kiểm chứng |
|---|---|---|---|
| FR-01 Tạo đơn | US-01 | CREATED, mã duy nhất, phí và tọa độ lưu DB, history ban đầu | API lưu feeVnd, tọa độ và history khi tạo; chờ Q03 |
| FR-02 Gán pickup | US-02 | Admin gán shipper rảnh gần nhất, PENDING_PICKUP | Admin chọn destinationHubId, fallback pickupLat/Lng cho đơn cũ, transaction và notifier đã có |
| FR-03 Lấy hàng | US-03 | Đúng shipper xác nhận, assignment in_progress | Service kiểm assignment từ DB và cập nhật in_progress; chờ Q03 |
| FR-04 Qua hub và last mile | US-04 | IN_TRANSIT → AT_HUB → OUT_FOR_DELIVERY | Kho gửi hubId khi arrive_at_hub; admin dispatch_last_mile tại hub đích |
| FR-05 Giao thành công | US-05 | Bằng chứng đã kiểm tra, DELIVERED, assignment completed | API nhận deliveryProofRef và lưu chuỗi tham chiếu, chưa xác minh nội dung bằng chứng |
| FR-06 Giao lại | US-06 | Lưu lý do, tăng số lần, retry dưới ngưỡng 3 | Guard có, job và assignment cần B01 |
| FR-07 Hoàn trả | US-07 | RETURNING → RETURNED, đóng assignment | Guard có, chưa có AssignmentType return |
| FR-08 Hủy | US-08 | Chủ đơn hủy trước lấy hàng, đóng assignment | Service kiểm chủ đơn từ DB và đóng assignment cancelled; chờ Q03 |
| FR-09 Thất lạc | US-09 | >72 giờ ở IN_TRANSIT/AT_HUB → LOST | Guard có, job SLA/ticket còn thiếu |
| FR-10 Tracking | US-01–09 | Mã tracking, timeline, socket theo room | REST có location nullable, socket và GPS được lưu sau kiểm quyền; chờ Q03 reconnect |
| FR-11 Auth | TEAM tuần 2 | Register chỉ customer, login JWT, phân quyền theo DB | Có guard và quyền chủ đơn/assignment/GPS từ DB; chờ Q01/Q03 |
| FR-12 Sự kiện | TEAM tuần 4 | Sau commit, không phát khi rollback | ParcelNotifierService nhận history ID/snapshot sau create, assign và status |
| FR-13 Pricing | TEAM tuần 2 | VND nhất quán, reload lấy phí đã lưu | API create lưu feeVnd, tải lại trả phí đã lưu |
| FR-14 Webhook | Topic 4 / B03 | POST có ký sau commit, lỗi receiver không sửa trạng thái | ParcelNotifierService gửi HMAC, timeout 2000 ms, log lỗi; chưa retry/outbox |

## 3. Quyền và trạng thái

Schema có bốn Role gồm customer, shipper, warehouse_staff, admin. Admin được assign_courier và dispatch_last_mile, ParcelsService ánh xạ admin sang actor dispatcher. Dispatcher không phải tài khoản đăng ký. System là actor dành riêng job nội bộ. Không nâng admin thành mọi vai trò kho/tài xế.

Bảng actor/event đủ 16 transition và guard trong m3.md mục 2.2, khớp transition-table.ts. DELIVERED, RETURNED, CANCELLED, LOST là terminal. Request status chỉ gồm event và các trường hubId/deliveryProofRef theo thao tác. Các guard isHubLocation, isFinalHub, hasDeliveryProof và quyền assignment được suy ra trong service, không nhận làm cờ request.

Status, history, failedAttemptCount và assignment phải cùng transaction. Cập nhật đồng thời cần kiểm trạng thái cũ hoặc Serializable và xử lý conflict 409. Chỉ emit sau commit. M3 cung cấp guard thuần, M2 ghi persistence và side effect. Chỉ mục tọa độ là B-tree quan hệ. Haversine hiện tính trong ứng dụng, chưa có PostGIS.

## 4. Mô hình dữ liệu

ERD trong m3.md và uml/erd.puml phản ánh User, Parcel, ParcelStatusHistory, Location, DeliveryAssignment. Migration cũ được giữ nguyên. Migration mới thêm feeVnd, senderLat/Lng, receiverLat/Lng, deliveryProof, deliveredAt dưới dạng nullable.

Dữ liệu cũ thiếu trường vẫn đọc được với giá trị null. Không backfill số 0 hoặc giả bằng chứng giao cho đơn DELIVERED cũ. Không tự tính lại phí đơn cũ. API tạo đơn hiện lưu phí/tọa độ. API confirm_delivery trim deliveryProofRef rồi lưu vào deliveryProof, tối đa 200 ký tự; hiện kiểm chuỗi không rỗng, chưa xác minh ảnh/chữ ký/OTP. deliveredAt đang được code a230451 gán ở mọi lần updateStatus nên chưa dùng riêng cột này làm bằng chứng thời điểm giao. Quy tắc assignment và bằng chứng tối thiểu tại INTEGRATION.md.

Seed có admin, warehouse_staff, customer, hai shipper có tọa độ và hai hub, chạy lại giữ dữ liệu có sẵn. Không có tài khoản system/dispatcher và không có mật khẩu mặc định trong Git.

## 5. API và thời gian thực

OpenAPI 3.1 tại openapi-spec.yaml đối chiếu DTO/controller/service trên develop a230451. Các route nội bộ có JWT và kiểm quyền tương ứng. GET /api/parcels/hubs dành cho admin/warehouse_staff, trả danh sách hub gồm id, name, address sắp theo name. Route này được khai báo trước /{id}.

PATCH /api/parcels/{id}/assign-courier dành cho admin, nhận destinationHubId để chọn hub đích và lưu destinationLocationId. Có thể bỏ destinationHubId chỉ khi đơn đã lưu hub đích hợp lệ. Đơn mới dùng senderLat/senderLng trong DB. pickupLat/pickupLng chỉ dùng làm cặp tọa độ fallback cho đơn cũ thiếu tọa độ, thiếu cặp này trả 400. Không có tài xế rảnh trả 409.

PATCH /api/parcels/{id}/status nhận event, hubId khi arrive_at_hub và deliveryProofRef khi confirm_delivery. hubId phải trỏ Location.type=hub. Service dùng currentLocationId và destinationLocationId để xác định hub cuối. deliveryProofRef phải không rỗng sau trim, tối đa 200 ký tự. Request không khai báo các cờ isHubLocation, isFinalHub, hasDeliveryProof. Ví dụ chính xác nằm trong INTEGRATION.md.

Payload socket giữ trackingCode, currentStatus, event.status/timestamp. GET /api/public/track/{code} có location là object trackingCode/latitude/longitude/timestamp hoặc null khi chưa có GPS. Điều phối chặng cuối xóa GPS cũ về null. Sau reconnect, M1 join lại room và tải REST để đồng bộ timeline/vị trí. GPS yêu cầu JWT shipper qua handshake auth.token, assignment đang hoạt động và tài khoản active, lưu vào DB trước khi phát sự kiện. Public tracking dùng receiverName/raw status nhưng không trả điện thoại, địa chỉ hoặc bằng chứng giao.

Webhook HTTP đã có trong ParcelNotifierService. onTransition nhận thêm notification={id,update}, id lấy từ history đã commit. Body có eventId, type=parcel.status.updated, occurredAt=data.event.timestamp, data là payload status socket. HMAC-SHA256 ký timestamp + "." + rawBody UTF-8, header X-Webhook-Signature có dạng sha256=<hex>, X-Webhook-Id trùng eventId, X-Webhook-Timestamp là Unix time giây lúc gửi. Timeout cố định 2000 ms, từ chối redirect, URL HTTPS hoặc HTTP loopback. Lỗi receiver/timeout được log và không đảo trạng thái đã commit. Hiện gửi một lần, chưa có retry tự động hoặc outbox. Đối chiếu chi tiết và ví dụ tại INTEGRATION.md.
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

HTTP limiter hiện nằm trong bộ nhớ một process. Gateway giới hạn 30 message/socket trong 10 giây. Các số đo cục bộ cũ và CI trên SHA khác chỉ là bằng chứng lịch sử. Ghi kết quả hiện có và mục chưa nghiệm thu trong GIT_SUBMISSION.md.
