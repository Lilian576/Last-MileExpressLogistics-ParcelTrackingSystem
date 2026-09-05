import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Parcel, ParcelStatus } from "../../types/parcel";
import { subscribeToParcel, trackParcel, USE_MOCK } from "../../api/parcelApi";
import { mockForceTransition } from "../../api/mockBackend";
import { Timeline } from "./Timeline";

export function TrackingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(code ?? "");

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cleanup: (() => void) | undefined;

    setLoading(true);
    setNotFound(false);
    setParcel(null);

    // 1. Lấy snapshot hiện tại (GET /api/public/track/:code)
    trackParcel(code)
      .then((p) => {
        if (!p) {
          setNotFound(true);
          return;
        }
        setParcel(p);
        // 2. Join room realtime để nhận cập nhật tiếp theo
        cleanup = subscribeToParcel(code, (updated) => setParcel(updated), setConnected);
      })
      .finally(() => setLoading(false));

    return () => cleanup?.();
  }, [code]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputCode.trim()) navigate(`/tracking/${inputCode.trim()}`);
  }

  return (
    <div className="paper-card">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>
        Tra cứu vận đơn
      </h3>

      <form onSubmit={handleSearch} className="search-row" style={{ marginBottom: 20 }}>
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Nhập mã vận đơn (VD: LM2026081100123)"
        />
        <button className="btn btn-primary" type="submit">
          Tra cứu
        </button>
      </form>

      {loading && <div className="muted">Đang tải...</div>}
      {notFound && <div className="error">Không tìm thấy đơn hàng với mã này.</div>}

      {parcel && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div className="tracking-code-stamp" style={{ fontSize: 15, padding: "5px 10px" }}>
              {parcel.trackingCode}
            </div>
            <span className={`live-badge ${connected ? "" : "offline"}`}>
              <span className="live-dot" />
              {connected ? "Đang theo dõi real-time" : "Mất kết nối"}
            </span>
          </div>

          <p className="muted" style={{ marginTop: 12 }}>
            Từ <b>{parcel.sender.province}</b> đến <b>{parcel.receiver.province}</b> · Người nhận:{" "}
            {parcel.receiver.fullName}
          </p>

          <Timeline history={parcel.history} currentStatus={parcel.currentStatus} />

          {USE_MOCK && parcel.currentStatus !== "DELIVERED" && parcel.currentStatus !== "RETURNED" && (
            <div className="demo-controls">
              <div className="muted" style={{ marginBottom: 8 }}>
                🧪 Công cụ demo (chỉ hiện khi dùng mock) — bấm để giả lập tài xế cập nhật trạng thái ngay lập tức,
                không cần đợi auto-progress:
              </div>
              <DemoButtons trackingCode={parcel.trackingCode} currentStatus={parcel.currentStatus} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DemoButtons({ trackingCode, currentStatus }: { trackingCode: string; currentStatus: ParcelStatus }) {
  const options: Record<ParcelStatus, ParcelStatus[]> = {
    CREATED: ["PICKED_UP"],
    PICKED_UP: ["AT_SORTING_CENTER"],
    AT_SORTING_CENTER: ["IN_TRANSIT"],
    IN_TRANSIT: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY"],
    FAILED_DELIVERY: ["RESCHEDULED", "RETURNED"],
    RESCHEDULED: ["OUT_FOR_DELIVERY"],
    DELIVERED: [],
    RETURNED: [],
  };
  const next = options[currentStatus] ?? [];
  return (
    <>
      {next.map((s) => (
        <button key={s} className="btn" onClick={() => mockForceTransition(trackingCode, s)}>
          → {s}
        </button>
      ))}
    </>
  );
}
