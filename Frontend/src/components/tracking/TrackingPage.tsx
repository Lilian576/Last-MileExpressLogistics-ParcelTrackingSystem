import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Parcel, ParcelLocationUpdate, ParcelStatus, TERMINAL_STATUSES } from "../../types/parcel";
import { subscribeToParcelRealtime, trackParcel, USE_MOCK } from "../../api/parcelApi";
import { mockForceTransition } from "../../api/mockBackend";
import { Timeline } from "./Timeline";
import { DriverMap } from "./DriverMap";

type LoadState = "idle" | "loading" | "ready" | "notfound" | "error";

const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString("vi-VN");

export function TrackingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(code ?? "");

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0); // tăng để tải lại sau lỗi API
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [location, setLocation] = useState<ParcelLocationUpdate | null>(null);

  const finished = parcel ? TERMINAL_STATUSES.includes(parcel.currentStatus) : true;

  useEffect(() => {
    if (!code) return;
    // Cờ chống race: nếu effect bị dọn (đổi mã / unmount / StrictMode chạy 2 lần) trước khi
    // trackParcel() trả về thì KHÔNG được mở socket nữa, nếu không socket sẽ bị rò rỉ.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    setLoadState("loading");
    setLoadError(null);
    setSyncError(null);
    setParcel(null);
    setLocation(null);
    setConnected(false);
    setLastSyncedAt(null);

    // 1. Snapshot hiện tại (GET /api/public/track/:code)
    trackParcel(code)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setLoadState("notfound");
          return;
        }
        setParcel(p);
        setLocation(p.location ?? null);
        setLoadState("ready");
        setLastSyncedAt(new Date());
        // 2. Đơn chưa kết thúc -> mở ĐÚNG MỘT socket cho cả trạng thái lẫn vị trí tài xế
        if (!TERMINAL_STATUSES.includes(p.currentStatus)) {
          cleanup = subscribeToParcelRealtime(code, p, {
            onParcel: setParcel,
            onLocation: setLocation,
            onConnectionChange: setConnected,
            onSync: (r) => {
              if (r.ok) {
                setLastSyncedAt(r.at);
                setSyncError(null);
              } else setSyncError(r.message);
            },
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Không tra cứu được đơn hàng.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [code, retry]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (inputCode.trim()) navigate(`/tracking/${inputCode.trim()}`);
  }

  // Chỉ dùng ở chế độ mock: giả lập mất mạng 3s rồi resync như reconnect thật
  function simulateNetworkGlitch() {
    if (!code) return;
    setConnected(false);
    setTimeout(async () => {
      try {
        const fresh = await trackParcel(code);
        if (fresh) setParcel(fresh);
        setLastSyncedAt(new Date());
      } catch {
        // giữ nguyên dữ liệu cũ
      }
      setConnected(true);
    }, 3000);
  }

  const offline = loadState === "ready" && !finished && !connected;

  return (
    <div className="paper-card">
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 16 }}>
        Tra cứu vận đơn
      </h3>

      <form onSubmit={handleSearch} className="search-row" style={{ marginBottom: 20 }}>
        <input
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Nhập mã vận đơn (VD: PCL1786000000000)"
          aria-label="Mã vận đơn"
        />
        <button className="btn btn-primary" type="submit">
          Tra cứu
        </button>
      </form>

      {loadState === "loading" && <div className="muted">Đang tải...</div>}
      {loadState === "notfound" && (
        <div className="error" role="alert">
          Không tìm thấy đơn hàng với mã “{code}”. Vui lòng kiểm tra lại mã vận đơn.
        </div>
      )}
      {loadState === "error" && (
        <div className="error" role="alert">
          {loadError}{" "}
          <button className="btn" type="button" onClick={() => setRetry((n) => n + 1)}>
            Thử lại
          </button>
        </div>
      )}

      {loadState === "ready" && parcel && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div className="tracking-code-stamp" style={{ fontSize: 15, padding: "5px 10px" }}>
              {parcel.trackingCode}
            </div>
            <span className={`live-badge ${connected && !finished ? "" : "offline"}`}>
              <span className="live-dot" />
              {finished ? "Đơn đã kết thúc" : connected ? "Đang theo dõi real-time" : "Mất kết nối"}
            </span>
          </div>

          {offline && (
            <div className="notice notice-warn" role="alert">
              Mất kết nối real-time — đang tự động kết nối lại. Dữ liệu bên dưới có thể chưa phải mới nhất
              {lastSyncedAt && ` (đồng bộ lần cuối lúc ${fmtTime(lastSyncedAt)})`}.
            </div>
          )}
          {syncError && !offline && (
            <div className="notice notice-warn" role="alert">
              Chưa đồng bộ được dữ liệu mới nhất: {syncError}
            </div>
          )}

          <p className="muted" style={{ marginTop: 12 }}>
            {parcel.sender.province && parcel.receiver.province && (
              <>
                Từ <b>{parcel.sender.province}</b> đến <b>{parcel.receiver.province}</b> ·{" "}
              </>
            )}
            Người nhận: {parcel.receiver.fullName}
          </p>

          {!finished && (
            <div style={{ marginTop: 16 }}>
              {location ? (
                <>
                  <DriverMap location={location} />
                  <div className="muted" style={{ marginTop: 6 }}>
                    📍 {offline ? "Vị trí gần nhất đã nhận" : "Vị trí tài xế"}: {location.latitude.toFixed(5)},{" "}
                    {location.longitude.toFixed(5)} · cập nhật lúc {fmtTime(location.timestamp)}
                    {offline && " (có thể đã cũ)"}
                  </div>
                </>
              ) : (
                <div className="muted">📍 Chưa có vị trí tài xế — sẽ hiện khi tài xế bắt đầu di chuyển.</div>
              )}
            </div>
          )}

          <Timeline history={parcel.history} currentStatus={parcel.currentStatus} />

          {USE_MOCK && !finished && (
            <div className="demo-controls">
              <div className="muted" style={{ marginBottom: 8 }}>
                🧪 Công cụ demo (chỉ hiện khi dùng mock) — bấm để giả lập cập nhật trạng thái ngay lập tức:
              </div>
              <DemoButtons trackingCode={parcel.trackingCode} currentStatus={parcel.currentStatus} />
              <button className="btn" style={{ marginTop: 8 }} onClick={simulateNetworkGlitch}>
                🔌 Giả lập mất mạng 3s (test reconnect)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DemoButtons({ trackingCode, currentStatus }: { trackingCode: string; currentStatus: ParcelStatus }) {
  // Rút gọn từ VALID_TRANSITIONS (types/parcel.ts) — chỉ hiện các nhánh
  // dùng để demo nhanh trên UI, không cần liệt kê hết mọi nhánh phụ.
  const options: Record<ParcelStatus, ParcelStatus[]> = {
    CREATED: ["PENDING_PICKUP"],
    PENDING_PICKUP: ["PICKED_UP"],
    PICKED_UP: ["IN_TRANSIT"],
    IN_TRANSIT: ["AT_HUB"],
    AT_HUB: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED"],
    DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNING"],
    RETURNING: ["RETURNED"],
    DELIVERED: [],
    RETURNED: [],
    CANCELLED: [],
    LOST: [],
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
