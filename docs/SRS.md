# Software Requirements Specification — LẹMail

Phiên bản 1.0, ngày 2026-10-27. Baseline yêu cầu: [m3.md](m3.md), phân công và checklist: [TEAM.md](../TEAM.md). Đây là đặc tả đích; không khẳng định mọi yêu cầu đã được triển khai. Chưa có bản handbook độc lập trong repo để kiểm tra tiêu chí ngoài TEAM.md.

## 1. Mục đích và phạm vi

Hệ thống quản lý vòng đời kiện hàng last-mile: tạo đơn, tính phí, phân công shipper, lấy hàng, trung chuyển, giao hàng, giao lại, hoàn trả, hủy và xử lý thất lạc. Khách tra cứu lịch sử và nhận cập nhật thời gian thực. MVP không bao gồm thanh toán ngân hàng, tối ưu tuyến đường nhiều điểm hay giải quyết bồi thường tự động.

## 2. Người dùng và môi trường

Sender/customer tạo và hủy đơn của mình; shipper xử lý các assignment được giao; warehouse_staff quét nhập/xuất hub; dispatcher điều phối; system chạy các job retry/SLA; admin quản trị. Người nhận không bắt buộc có tài khoản. Dispatcher là vai trò nghiệp vụ, hiện Prisma chưa có enum tương ứng: cần thống nhất ánh xạ quyền trước triển khai.

Frontend React/TypeScript giao tiếp REST và Socket.IO với NestJS; PostgreSQL/Prisma lưu dữ liệu; JWT xác thực API cần quyền. DB và secret được cấu hình qua môi trường, không đưa secret vào tài liệu hoặc Git.

## 3. Yêu cầu chức năng và truy vết

Mỗi FR dưới đây được nghiệm thu bằng toàn bộ Scenario của mục Gherkin tương ứng trong m3.md, gồm cả nhánh thất bại. Mã US dùng đồng nhất trong bộ issue ở [issues](issues/README.md).

| ID | Story / nguồn | Yêu cầu bắt buộc | Chủ trì vai trò |
|---|---|---|---|
| FR-01 | US-01 / §1.1 | Tạo parcel CREATED, tracking code duy nhất, ghi lịch sử; từ chối thiếu receiver_address | M2 |
| FR-02 | US-02 / §1.2 | Gán shipper khả dụng gần nhất, tạo assignment assigned và PENDING_PICKUP; không có shipper thì giữ CREATED và retry | M2 |
| FR-03 | US-03 / §1.3 | Chỉ shipper được gán xác nhận PICKED_UP, assignment in_progress và ghi vị trí; lấy thất bại giữ PENDING_PICKUP và ghi lý do | M2 |
| FR-04 | US-04 / §1.4 | PICKED_UP → IN_TRANSIT ↔ AT_HUB; chỉ quét tại hub hợp lệ; cập nhật vị trí; hub cuối gán last-mile và OUT_FOR_DELIVERY | M2 |
| FR-05 | US-05 / §1.5 | Chỉ xác nhận DELIVERED khi có ảnh/chữ ký; hoàn tất assignment và completed_at; thông báo customer | M2 |
| FR-06 | US-06 / §1.6 | Lưu lý do và tăng failed_attempt_count; còn lượt thì retry OUT_FOR_DELIVERY, hết lượt thì RETURNING | M3 |
| FR-07 | US-07 / §1.7 | Xác nhận trả sender: RETURNED, ghi lịch sử và hoàn tất assignment trả hàng | M2 |
| FR-08 | US-08 / §1.8 | Chủ đơn chỉ hủy từ CREATED/PENDING_PICKUP; hủy assignment liên quan; sau pickup trả lỗi theo Gherkin | M3 |
| FR-09 | US-09 / §1.9 | IN_TRANSIT/AT_HUB không cập nhật hơn 72 giờ → LOST, tạo ticket và thông báo customer | M3 |
| FR-10 | Bảng public status | Public tracking ánh xạ đúng toàn bộ trạng thái theo đầu m3.md, không lộ LOST hoặc lý do thất bại nội bộ | M1 |
| FR-11 | TEAM tuần 2 | Đăng ký, đăng nhập JWT, kiểm tra role, quyền sở hữu đơn và shipper assignment từ DB | M3 |
| FR-12 | TEAM tuần 4 | Subscribe room theo trackingCode; sau commit phát parcel.status.updated, DELIVERED phát thêm parcel.delivery.completed | M2 |
| FR-13 | TEAM / README | Báo phí VND theo trọng lượng và khoảng cách; trả phí nhất quán với thông tin nhập | M2 |

## 4. Quy tắc dữ liệu và trạng thái

16 transition trong m3.md §2.2 là nguồn chuẩn. DELIVERED, RETURNED, CANCELLED, LOST là terminal. Retry tối đa mặc định 3 lần thất bại; SLA thất lạc là >72 giờ. Những ngưỡng này cần cấu hình thống nhất giữa job và guard.

Mỗi transition thành công phải ghi mới ParcelStatusHistory; không sửa/xóa lịch sử. Status, history, assignment và failedAttemptCount phải commit trong cùng transaction. Cập nhật đồng thời phải kiểm tra trạng thái cũ để tránh hai transition thắng cùng lúc. Transition bị từ chối hoặc rollback không phát event. TrackingCode phải có unique constraint và cơ chế xử lý collision.

Mô hình dữ liệu: User, Parcel, Location, DeliveryAssignment, ParcelStatusHistory; chi tiết ERD trong m3.md §3, UML tại [uml](uml/README.md). Assignment trả hàng được yêu cầu bởi US-07 nhưng schema hiện chưa có loại return; ticket khiếu nại và bằng chứng giao hàng cũng chưa có model: cần migration trước nghiệm thu các story này.

## 5. Giao diện

API đang có: POST /auth/register, POST /auth/login; POST /api/parcels/calculate-fee; POST/GET /api/parcels; GET /api/parcels/:id; PATCH /api/parcels/:id/status; PATCH /api/parcels/:id/assign-courier. DTO/backend dùng camelCase, tên snake_case trong m3.md là tên DB/nghiệp vụ.

API mục tiêu cần thống nhất với M1: POST /api/parcels/quote (hiện frontend kỳ vọng khác calculate-fee), GET /api/parcels/mine, GET /api/public/track/:code. Đây là các khoảng trống tích hợp, không coi là endpoint đã có. Lỗi: 400 input/transition không hợp lệ; 401 chưa xác thực; 403 sai quyền; 404 không tìm thấy; 409 xung đột đồng thời; 429 quá hạn mức.

Hợp đồng sau transition và rate limiting: [INTEGRATION.md](INTEGRATION.md).

## 6. Yêu cầu phi chức năng và nghiệm thu

| ID | Yêu cầu có thể kiểm tra | Cách nghiệm thu |
|---|---|---|
| NFR-01 | Mặc định mỗi IP tối đa 120 HTTP request/60s, login+register cộng dồn tối đa 10/60s; trả 429 và Retry-After | Test vượt ngưỡng, IP độc lập, hết cửa sổ, giả X-Forwarded-For |
| NFR-02 | Không cho client tự quyết định quyền/guard nhạy cảm; mật khẩu hash, secret ngoài Git | Review auth, test quyền sở hữu/assignment và input |
| NFR-03 | WebSocket đến UI dưới 1 giây trong demo local, reconnect và subscribe lại được | M4 đo timestamp, ngắt mạng giả lập, kiểm tra timeline |
| NFR-04 | Rollback không để lại status/history/assignment rời rạc, không emit | Integration test transaction fail và concurrent update |
| NFR-05 | Ít nhất 10 test state machine; từng transition hợp lệ/sai quyền/sai guard và terminal được kiểm tra | Jest + báo cáo CI, test end-to-end CREATED → DELIVERED |
| NFR-06 | Không đưa email, số điện thoại, địa chỉ, lý do LOST vào public event | Kiểm tra JSON của public tracking và WebSocket |

Rate limiter hiện lưu trong từng process, mất khi restart. Triển khai nhiều replica cần shared store/gateway limit; không coi giới hạn hiện tại là quota dùng chung toàn cluster.

## 7. Điều kiện hoàn tất tuần 1

9 GitHub Issues có nguyên User Story và Gherkin, mỗi issue đúng 1 assignee GitHub; SRS + Use Case/Class/Sequence + ERD/State Machine có truy vết; review giữa các thành viên. TEAM.md còn yêu cầu OpenAPI draft, CI và mỗi người ít nhất 1 PR merged vào develop: các mục đó cần bằng chứng riêng, không tự đánh dấu hoàn tất trong lần sửa này.
