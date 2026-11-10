import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { listAssignedParcels, updateParcelStatus } from "../../api/driverApi";
import { AuthExpiredError } from "../../api/errors";
import { DriverParcel, ShipperAction } from "../../types/driver";
import { TERMINAL_STATUSES } from "../../types/parcel";
import { clearDriverSession, getDriverSession } from "../../lib/driverSession";
import { DriverParcelCard } from "./DriverParcelCard";
import { useDriverGps } from "../../lib/driverGps";

const REFRESH_MS = 15000;

// Danh sách mới từ server + giữ lại các đơn VỪA hoàn tất trong phiên này
// (server không trả đơn đã kết thúc nữa, nhưng tài xế vẫn cần thấy kết quả).
function mergeList(fresh: DriverParcel[], prev: DriverParcel[]): DriverParcel[] {
  const ids = new Set(fresh.map((p) => p.id));
  const keptDone = prev.filter((p) => TERMINAL_STATUSES.includes(p.currentStatus) && !ids.has(p.id));
  return [...fresh, ...keptDone];
}

export function DriverOrdersPage() {
  const navigate = useNavigate();
  const session = getDriverSession();
  const token = session?.accessToken;

  const [parcels, setParcels] = useState<DriverParcel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [shareGps, setShareGps] = useState(true);
  const gps = useDriverGps(parcels, shareGps, token);

  const logout = useCallback(() => {
    clearDriverSession();
    navigate("/driver/login", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await listAssignedParcels(token);
      setParcels((prev) => mergeList(fresh, prev ?? []));
      setLoadError(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) return logout();
      setLoadError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }, [token, logout]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!session || !token) return <Navigate to="/driver/login" replace />;

  async function handleAction(parcel: DriverParcel, action: ShipperAction, hasProof: boolean) {
    setBusyId(parcel.id);
    setRowError((e) => ({ ...e, [parcel.id]: "" }));
    try {
      const newStatus = await updateParcelStatus(token!, parcel, action, hasProof);
      setParcels((list) => list?.map((p) => (p.id === parcel.id ? { ...p, currentStatus: newStatus } : p)) ?? list);
    } catch (err) {
      if (err instanceof AuthExpiredError) return logout();
      setRowError((e) => ({ ...e, [parcel.id]: err instanceof Error ? err.message : "Có lỗi xảy ra" }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="paper-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>Đơn được giao</h3>
          <div className="muted">Tài xế: {session.user.fullName}</div>
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

      <label className="gps-toggle">
        <input type="checkbox" checked={shareGps} onChange={(e) => setShareGps(e.target.checked)} />
        Chia sẻ vị trí cho khách khi đang giao
        {gps.active && (
          <span className="muted">
            · {gps.source === "gps" ? "GPS thiết bị" : "GPS giả lập"}
            {gps.lastSent && ` · gửi lúc ${gps.lastSent.toLocaleTimeString("vi-VN")}`}
            {gps.rejected && <b role="alert"> · ⚠ server từ chối vị trí: {gps.rejected}</b>}
          </span>
        )}
      </label>

      {parcels === null && !loadError && <div className="muted">Đang tải danh sách đơn...</div>}
      {loadError && (
        <div className="error" role="alert">
          {loadError}
        </div>
      )}

      {parcels && parcels.length === 0 && (
        <div className="orders-empty">
          <p className="muted">Hiện chưa có đơn nào được giao cho bạn.</p>
        </div>
      )}

      {parcels && parcels.length > 0 && (
        <ul className="order-list">
          {parcels.map((p) => (
            <DriverParcelCard
              key={p.id}
              parcel={p}
              busy={busyId === p.id}
              error={rowError[p.id]}
              onAction={handleAction}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
