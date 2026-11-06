import { useState } from "react";
import { DriverParcel, SHIPPER_ACTIONS, ShipperAction, WAITING_NOTE } from "../../types/driver";
import { ParcelStatus, STATUS_LABEL, TERMINAL_STATUSES } from "../../types/parcel";

const WARN: ParcelStatus[] = ["DELIVERY_FAILED", "RETURNING", "RETURNED", "CANCELLED", "LOST"];

function tone(status: ParcelStatus): "ok" | "warn" | "pending" {
  if (status === "DELIVERED") return "ok";
  return WARN.includes(status) ? "warn" : "pending";
}

interface Props {
  parcel: DriverParcel;
  busy: boolean;
  error?: string;
  onAction: (parcel: DriverParcel, action: ShipperAction, hasProof: boolean) => void;
}

export function DriverParcelCard({ parcel, busy, error, onAction }: Props) {
  const [hasProof, setHasProof] = useState(false);
  const actions = SHIPPER_ACTIONS[parcel.currentStatus] ?? [];
  const needsProof = actions.some((a) => a.needsProof);
  const finished = TERMINAL_STATUSES.includes(parcel.currentStatus);

  return (
    <li className="driver-card">
      <div className="order-row-top">
        <span className="order-code">{parcel.trackingCode}</span>
        <span className={`status-chip status-${tone(parcel.currentStatus)}`}>{STATUS_LABEL[parcel.currentStatus]}</span>
      </div>

      <div className="order-row-mid">
        Giao đến <b>{parcel.receiverName}</b> ·{" "}
        <a href={`tel:${parcel.receiverPhone}`} className="driver-phone">
          {parcel.receiverPhone}
        </a>
        <div className="muted">{parcel.receiverAddress}</div>
        <div className="muted">Khối lượng: {parcel.weightKg} kg</div>
      </div>

      {needsProof && (
        <label className="driver-proof">
          <input type="checkbox" checked={hasProof} onChange={(e) => setHasProof(e.target.checked)} disabled={busy} />
          Đã có bằng chứng giao hàng (ảnh / chữ ký người nhận)
        </label>
      )}

      {actions.length > 0 && (
        <div className="driver-actions">
          {actions.map((a) => (
            <button
              key={a.event}
              className={`btn ${a.tone === "primary" ? "btn-primary" : "btn-danger"}`}
              disabled={busy || (a.needsProof && !hasProof)}
              onClick={() => onAction(parcel, a, hasProof)}
            >
              {busy ? "Đang cập nhật..." : a.label}
            </button>
          ))}
        </div>
      )}

      {actions.length === 0 && (
        <div className="muted driver-wait">
          {finished ? "✓ Đơn đã hoàn tất" : WAITING_NOTE[parcel.currentStatus] ?? "Chưa có thao tác dành cho tài xế"}
        </div>
      )}

      {error && (
        <div className="error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </li>
  );
}
