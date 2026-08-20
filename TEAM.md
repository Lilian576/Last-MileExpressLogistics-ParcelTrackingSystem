# TEAM.md
## Last-Mile Express Logistics & Parcel Tracking System
### Môn Công nghệ phần mềm (502045) — Nhóm 4 người
### Phân công theo đúng handbook chính thức của giảng viên (Topic 4)

---

## 1. Phân công vai trò (theo giảng viên)

| Vai trò | Nhiệm vụ chính thức | Công nghệ áp dụng |
|---|---|---|
M1 – Frontend/UI-UX Lead** | Sender package creation wizard, public parcel tracking timeline UI | React + TypeScript, Socket.io-client (subscribe room tracking real-time), gọi REST API tạo đơn |
M2 – Backend API/Microservices Lead** (Trưởng nhóm) | Pricing engine API, driver assignment routing service, webhook updates | NestJS, tính phí (khoảng cách/trọng lượng), **WebSocket Gateway** (emit event real-time) |
M3 – Database, Auth & Security Lead** | Spatial/Relational DB setup, status state-machine design, API gateway auth | PostgreSQL + Prisma, **StateMachineService** (transition table), JWT + Passport.js, rate limiting |
M4 – QA, DevOps & Integration Test Lead** | Automated state-machine validation tests, end-to-end delivery workflow tests | Jest + Supertest, Artillery (load test), Docker Compose, GitHub Actions CI |

**Điểm giao tiếp bắt buộc:**
- M2 ↔ M3: thống nhất interface gọi khi transition thành công (VD: `onTransition(parcelId, from, to)` để M2 emit WebSocket)
- M2 ↔ M1: thống nhất format JSON của WebSocket event (event name, payload)
- M3 ↔ M4: M3 cung cấp transition table rõ ràng để M4 viết test case đầy đủ

---

---

## 3. Checklist 4 tuần đầu

### TUẦN 1 — Analysis + Architecture + Setup

**Mục tiêu:** Có SRS, ERD, OpenAPI spec draft, repo sẵn sàng, thống nhất interface giữa các module.

- Cả nhóm: Họp xác nhận phân công (file này), thống nhất phạm vi MVP
- M2 (Trưởng nhóm): Tạo GitHub repo, mời 4 thành viên, bật branch protection `main`
- M2: Tạo GitHub Project (Kanban: Backlog → In Progress → Review → Done)
- M3: Viết User Story + Gherkin cho toàn bộ luồng parcel
- M3: Vẽ sơ đồ State Machine (transition table đầy đủ)
- M3: Thiết kế ERD (users, parcels, parcel_status_history, locations, delivery_assignments)
- M1: Wireframe UI (Figma) cho Customer flow (wizard tạo đơn, tracking page)
- M2: Wireframe Driver + Admin UI; research NestJS `@WebSocketGateway()`
- M4: Setup CI skeleton (GitHub Actions chạy lint/test rỗng)
- Cả nhóm: Review và chốt OpenAPI spec draft
- M2 ↔ M3: Họp riêng thống nhất trước format event payload + interface gọi khi transition
- Cả nhóm: Mỗi người tạo ít nhất 1 PR, merge vào `develop`

**Deliverable:** SRS, ERD, OpenAPI draft, repo có CI chạy được
**DoD:** Repo build được, mỗi người ≥1 PR merged, thống nhất event payload xong

---

### TUẦN 2 — Backend Foundation + REST API cơ bản

**Mục tiêu:** Auth hoạt động, tạo/xem đơn hàng được qua API thật.

- M3: AuthModule hoàn chỉnh (register/login/JWT), migration chạy thật trên DB
- M2: ParcelModule CRUD cơ bản (tạo/xem đơn) — pricing engine tính phí đơn giản
- M1: Customer UI kết nối API tạo đơn, xem danh sách đơn
- M2: Driver UI skeleton (login, xem danh sách assignment — chưa có data thật)
- M4: Viết unit test đầu tiên cho pricing engine
- Cả nhóm: Demo nội bộ luồng "đăng ký → đăng nhập → tạo đơn → xem đơn"

**Deliverable:** Customer tạo được đơn hàng thật, lưu DB, xem lại được
**DoD:** POST/GET parcel hoạt động, có JWT guard, unit test cơ bản pass

---

### TUẦN 3 — State Machine + Parcel Lifecycle + Driver Functions

**Mục tiêu:** Toàn bộ vòng đời parcel hoạt động end-to-end (chưa real-time).

- M3: StateMachineService đầy đủ (transition table + validate logic)
- M2: API PATCH status, driver assignment routing service (gán tài xế gần nhất/đang rảnh)
- M1: TrackingPage hiển thị lịch sử trạng thái (tạm dùng polling)
- M2: Driver API integration (xem assignment, update status qua UI)
- M4: Unit test cho State Machine (test từng transition hợp lệ/không hợp lệ, ≥10 test case)
- Cả nhóm: Demo full flow CREATED → DELIVERED bằng tay (không real-time)

**Deliverable:** Vòng đời parcel hoạt động end-to-end
**DoD:** State Machine reject đúng transition không hợp lệ, ≥10 unit test pass

---

### TUẦN 4 — WebSocket + Real-time Tracking + Integration

**Mục tiêu:** Real-time tracking hoạt động thật — đây là điểm nhấn kỹ thuật chính của đồ án.

- M2: TrackingGateway (WebSocket server), room management theo trackingCode
- M2: Trigger emit event mỗi khi StateMachineService (M3) validate transition thành công
- M1: Frontend WebSocket client, subscribe room, hiển thị update real-time
- M2: Driver app gửi mock GPS định kỳ (location simulator) qua WebSocket
- M4: Test WebSocket connect/disconnect/reconnect
- M4: Viết integration test cho REST API (Supertest)
- Cả nhóm: Demo 2 màn hình song song — driver update trạng thái, customer thấy ngay lập tức

**Deliverable:** Real-time tracking hoạt động thật
**DoD:** WebSocket message đến trong <1s, reconnect hoạt động khi mất mạng giả lập

---

## 4. Git Workflow

**Branch naming:**
```
feature/state-machine        (M3)
feature/customer-ui          (M1)
feature/websocket-tracking   (M2)
feature/auth-jwt             (M3)
feature/driver-assignment    (M2)
```

**Commit convention:**
```
feat: add state transition validation for parcel
fix: correct WebSocket room join logic
test: add unit test for fee calculation
docs: update API spec for tracking endpoint
```

**Quy tắc PR:** Mỗi PR cần ít nhất 1 người khác review + approve trước khi merge. Merge strategy: Squash and merge vào `develop`.
