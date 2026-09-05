import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Parcel, ParcelStatus, STATUS_LABEL } from "../../types/parcel";
import { listMyParcels } from "../../api/parcelApi";

const FAIL_STATUSES: ParcelStatus[] = ["FAILED_DELIVERY", "RETURNED"];

function statusTone(status: ParcelStatus): "ok" | "warn" | "pending" {
  if (status === "DELIVERED") return "ok";
  if (FAIL_STATUSES.includes(status)) return "warn";
  return "pending";
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrdersPage() {
  const [parcels, setParcels] = useState<Parcel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMyParcels()
      .then((list) => {
        if (!cancelled) setParcels(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="paper-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, margin: 0 }}>Đơn hàng của tôi</h3>
        <Link to="/" className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
          + Tạo đơn mới
        </Link>
      </div>

      {loading && <div className="muted">Đang tải danh sách đơn...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && parcels && parcels.length === 0 && (
        <div className="orders-empty">
          <p className="muted">Bạn chưa tạo đơn hàng nào trên trình duyệt này.</p>
          <Link to="/">
            <button className="btn btn-primary" style={{ marginTop: 10 }}>
              Tạo đơn đầu tiên →
            </button>
          </Link>
        </div>
      )}

      {!loading && !error && parcels && parcels.length > 0 && (
        <ul className="order-list">
          {parcels.map((p) => (
            <li key={p.trackingCode} className="order-row">
              <Link to={`/tracking/${p.trackingCode}`} className="order-row-link">
                <div className="order-row-top">
                  <span className="order-code">{p.trackingCode}</span>
                  <span className={`status-chip status-${statusTone(p.currentStatus)}`}>
                    {STATUS_LABEL[p.currentStatus]}
                  </span>
                </div>
                <div className="order-row-mid">
                  Đến <b>{p.receiver.fullName}</b> · {p.receiver.province}
                </div>
                <div className="order-row-bottom">
                  <span className="muted">{formatTime(p.history[0]?.timestamp)}</span>
                  <span className="order-fee">{formatVnd(p.feeVnd)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
