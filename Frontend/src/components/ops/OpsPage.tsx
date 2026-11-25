import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { assignCourier, listAllParcels, listHubs, opsUpdateStatus, OPS_UNAVAILABLE_IN_MOCK } from "../../api/opsApi";
import { USE_MOCK } from "../../api/parcelApi";
import { AuthExpiredError } from "../../api/errors";
import { clearOpsSession, getOpsSession } from "../../lib/opsSession";
import { AssignCourierInput, OPS_ROLE_LABEL, OpsHub, OpsParcel, OpsRole, OpsStatusUpdate } from "../../types/ops";
import { ParcelStatus, STATUS_LABEL } from "../../types/parcel";
import { OpsParcelCard } from "./OpsParcelCard";

const REFRESH_MS = 15000;

export function OpsPage() {
  const navigate = useNavigate();
  const session = getOpsSession();
  const token = session?.accessToken;
  const role = session?.user.role as OpsRole | undefined;

  const [parcels, setParcels] = useState<OpsParcel[] | null>(null);
  const [hubs, setHubs] = useState<OpsHub[]>([]);
  const [hubError, setHubError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ParcelStatus | "ALL">("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowInfo, setRowInfo] = useState<Record<string, string>>({});

  const logout = useCallback(() => {
    clearOpsSession();
    navigate("/ops/login", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    if (!token || USE_MOCK) return;
    try {
      const list = await listAllParcels(token);
      setParcels(list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoadError(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return logout();
      setLoadError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }, [token, logout]);

  const loadHubs = useCallback(async () => {
    if (!token || USE_MOCK) return;
    try {
      setHubs(await listHubs(token));
      setHubError(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return logout();
      setHubError(err instanceof Error ? err.message : "Không tải được danh sách hub.");
    }
  }, [token, logout]);

  useEffect(() => {
    void loadHubs();
  }, [loadHubs]);

  useEffect(() => {
    void load(); // tải lại từ server mỗi lần mở trang -> reload vẫn thấy dữ liệu đã lưu
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (parcels ?? []).filter(
      (p) =>
        (statusFilter === "ALL" || p.currentStatus === statusFilter) &&
        (!q ||
          p.trackingCode.toLowerCase().includes(q) ||
          p.receiverName.toLowerCase().includes(q) ||
          p.receiverPhone.includes(q))
    );
  }, [parcels, query, statusFilter]);

  if (!session || !token || !role) return <Navigate to="/ops/login" replace />;

  async function run(parcel: OpsParcel, job: () => Promise<string | undefined>) {
    setBusyId(parcel.id);
    setRowError((e) => ({ ...e, [parcel.id]: "" }));
    setRowInfo((i) => ({ ...i, [parcel.id]: "" }));
    try {
      const info = await job();
      if (info) setRowInfo((i) => ({ ...i, [parcel.id]: info }));
      await load(); // lấy trạng thái thật từ server thay vì tự suy ra
    } catch (err) {
      if (err instanceof AuthExpiredError) return logout();
      setRowError((e) => ({ ...e, [parcel.id]: err instanceof Error ? err.message : "Có lỗi xảy ra" }));
    } finally {
      setBusyId(null);
    }
  }

  const onStatusAction = (parcel: OpsParcel, input: OpsStatusUpdate) =>
    run(parcel, async () => {
      const next = await opsUpdateStatus(token, parcel.id, input);
      return `Đã chuyển sang “${STATUS_LABEL[next]}”.`;
    });

  const onAssign = (parcel: OpsParcel, input: AssignCourierInput) =>
    run(parcel, async () => {
      const r = await assignCourier(token, parcel.id, input);
      const c = r.assignmentResult.courier;
      return c
        ? `Đã gán tài xế ${c.fullName}${r.assignmentResult.distanceKm != null ? ` (cách điểm lấy hàng ~${r.assignmentResult.distanceKm.toFixed(1)} km)` : ""}.`
        : "Đã gán tài xế.";
    });

  return (
    <div className="paper-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>Vận hành đơn hàng</h3>
          <div className="muted">
            {session.user.fullName} · {OPS_ROLE_LABEL[role]}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => void load()}>
            Làm mới
          </button>
          <button className="btn" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </div>

      {USE_MOCK && (
        <div className="notice notice-warn" role="alert">
          {OPS_UNAVAILABLE_IN_MOCK}
        </div>
      )}

      <div className="search-row" style={{ marginBottom: 16 }}>
        <input
          aria-label="Tìm đơn"
          placeholder="Tìm theo mã vận đơn, tên hoặc SĐT người nhận"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ParcelStatus | "ALL")}>
          <option value="ALL">Mọi trạng thái</option>
          {(Object.keys(STATUS_LABEL) as ParcelStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {parcels === null && !loadError && !USE_MOCK && <div className="muted">Đang tải danh sách đơn...</div>}
      {hubError && (
        <div className="error" role="alert">
          {hubError} <button className="btn" type="button" onClick={() => void loadHubs()}>Thử lại</button>
        </div>
      )}
      {loadError && (
        <div className="error" role="alert">
          {loadError}{" "}
          <button className="btn" type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      {parcels && visible.length === 0 && (
        <p className="muted">{parcels.length === 0 ? "Chưa có đơn nào trong hệ thống." : "Không có đơn nào khớp bộ lọc."}</p>
      )}
      {visible.length > 0 && (
        <ul className="order-list">
          {visible.map((p) => (
            <OpsParcelCard
              key={p.id}
              parcel={p}
              role={role}
              hubs={hubs}
              busy={busyId === p.id}
              error={rowError[p.id]}
              info={rowInfo[p.id]}
              onStatusAction={onStatusAction}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
