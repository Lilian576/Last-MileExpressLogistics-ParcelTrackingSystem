# Đẩy thay đổi lên GitHub và nộp bằng chứng

Repo: https://github.com/Lilian576/Last-MileExpressLogistics-ParcelTrackingSystem

## 1. Kiểm tra và commit

Chạy trong PowerShell tại thư mục gốc repo. Các thay đổi package.json, package-lock.json, .env.example và weather-surcharge đã có trước lần sửa này; danh sách git add bên dưới chỉ lấy các file thuộc yêu cầu SRS/UML/rate limiting/interface.

```powershell
git status --short
git switch -c feature/m3-srs-uml-rate-limit
git add -- backend/src/app.module.ts backend/src/common/rate-limit.middleware.ts backend/src/common/rate-limit.middleware.spec.ts backend/src/state-machine/transition-notifier.ts docs/SRS.md docs/INTEGRATION.md docs/GIT_SUBMISSION.md docs/uml docs/issues
git diff --cached --stat
git diff --cached --check
git commit -m "feat: add API rate limiting and week 1 requirements"
git push -u origin feature/m3-srs-uml-rate-limit
```

Nếu tên branch đã tồn tại, chọn tên mới hoặc chuyển sang branch đó nếu đúng branch đang làm. Khi Git yêu cầu đăng nhập, đăng nhập tài khoản có quyền ghi repo qua Git Credential Manager/trình duyệt; không gửi token vào chat.

## 2. Tạo Pull Request

Trên GitHub chọn Compare & pull request. Base là **develop**, compare là **feature/m3-srs-uml-rate-limit**. Nội dung PR đề xuất:

```text
Thêm SRS có truy vết 9 user story, UML Use Case/Class/Sequence và 9 bản thảo GitHub Issues giữ nguyên Gherkin trong docs/m3.md.

Thêm HTTP rate limiting theo IP: 120 request/60s toàn API, 10 request/60s dùng chung cho login/register; trả 429 và Retry-After. Cấu hình qua RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, RATE_LIMIT_AUTH_MAX.

Thêm contract TransitionNotifier.onTransition(parcelId, from, to, actor) cho M2 gọi sau commit DB thành công, cùng kiểu public payload { trackingCode, status, updatedAt }. Contract chưa được nối vào ParcelsService/TrackingGateway; chi tiết và khoảng trống tích hợp ở docs/INTEGRATION.md.

Validation: npm run build thành công; npm test -- --runInBand đạt 5 suites, 23 tests. Đã đối chiếu đủ 9 User Story/Gherkin với docs/m3.md.
```

Mời ít nhất một thành viên khác review và approve, sau đó Squash and merge vào develop theo TEAM.md. Không tự đánh dấu đã hoàn tất PR/review/merge trước khi thực hiện thật.

## 3. Tạo đủ 9 GitHub Issues và gán người

Đẩy file Markdown lên Git không tự tạo GitHub Issues. Mở tab Issues → New issue, lần lượt dùng [US-01](issues/US-01.md) đến [US-09](issues/US-09.md): lấy dòng tiêu đề làm title (bỏ dấu #), phần còn lại làm description, giữ nguyên toàn bộ User Story và Gherkin.

Ở Assignees, chọn **đúng một tài khoản** theo phân công đã chốt. Bảng M2/M3 trong [danh sách issue](issues/README.md) là đề xuất vai trò, cần đổi sang username thật; không mặc định chủ repo là người phụ trách mọi story. Kiểm tra issue hiện có để tránh tạo trùng.

Sau khi tạo, thay Pending trong docs/issues/README.md bằng URL issue thật; ghi username assignee đã chốt trong từng body. Commit và push bổ sung bảng truy vết này trên branch làm việc; nếu PR đã merge thì dùng branch/PR mới. Trong PR triển khai từng story, liên kết issue tương ứng. Đây mới là bằng chứng đáp ứng yêu cầu mỗi story có một người.

## 4. Kiểm tra local

```powershell
Set-Location backend
npm run build
npm test -- --runInBand
Set-Location ..
```

UML nằm ở docs/uml/*.puml; mở bằng PlantUML để preview hoặc xuất SVG/PNG khi cần nộp ảnh. Các sơ đồ hiện là file nguồn, chưa có ảnh render đính kèm.

Rate limiter lưu quota trong từng process; khi dùng nhiều replica phải dùng shared store/gateway. Tham số môi trường và cách xử lý reverse proxy nằm ở docs/INTEGRATION.md. Không cần dependency mới cho các thay đổi này.
