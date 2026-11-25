import { useState } from "react";
import { Link } from "react-router-dom";
import { OPS_ACTIONS, OPS_WAITING_NOTE, OpsAction, OpsParcel, OpsRole } from "../../types/ops";
import { ParcelStatus, STATUS_LABEL, TERMINAL_STATUSES } from "../../types/parcel";
import { PROVINCES, provinceToLatLng } from "../../lib/geo";

const WARN: ParcelStatus[] = ["DELIVERY_FAILED", "RETURNING", "RETURNED", "CANCELLED", "LOST"];
function tone(status: ParcelStatus): "ok" | "warn" | "pending" {
  if (status === "DELIVERED") return "ok";
  return WARN.includes(status) ? "warn" : "pending";
}

interface Props {
  parcel: OpsParcel;
  role: OpsRole;
  busy: boolean;
  error?: string;
  info?: string;
  onStatusAction: (parcel: OpsParcel, action: OpsAction) => void;
  onAssign: (parcel: OpsParcel, pickupLat: number, pickupLng: number) => void;
}

export function OpsParcelCard({ parcel, role, busy, error, info, onStatusAction, onAssign }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [province, setProvince] = useState(PROVINCES[0]);
  const [lat, setLat] = useState(String(provinceToLatLng(PROVINCES[0]).lat));
  const [lng, setLng] = useState(String(provinceToLatLng(PROVINCES[0]).lng));

  const all = OPS_ACTIONS[parcel.currentStatus] ?? [];
  const mine = all.filter((a) => a.roles.includes(role));
  const finished = TERMINAL_STATUSES.includes(parcel.currentStatus);
  const needsConfirm = mine.some((a) => a.confirm && !a.blocked);
  const assign = mine.find((a) => a.kind === "assign");

  function pickProvince(value: string) {
    setProvince(value);
    const c = provinceToLatLng(value);
    setLat(String(c.lat));
    setLng(String(c.lng));
  }

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk =
    lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(latN) && Number.isFinite(lngN) &&
    Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

  return (
    <li className="driver-card">
      <div className="order-row-top">
        <Link className="order-code" to={`/tracking/${parcel.trackingCode}`}>
          {parcel.trackingCode}
        </Link>
        <span className={`status-chip status-${tone(parcel.currentStatus)}`}>{STATUS_LABEL[parcel.currentStatus]}</span>
      </div>
      <div className="order-row-mid">
        Người nhận <b>{parcel.receiverName}</b> · <span className="driver-phone">{parcel.receiverPhone}</span>
        <div className="muted">{parcel.receiverAddress}</div>
        <div className="muted">
          {parcel.weightKg} kg · tạo lúc {new Date(parcel.createdAt).toLocaleString("vi-VN")}
        </div>
      </div>

      {assign && (
        <div className="ops-assign">
          <div className="muted">Điểm lấy hàng (toạ độ bắt buộc để chọn tài xế gần nhất):</div>
          <div className="ops-assign-row">
            <select aria-label="Tỉnh/thành điểm lấy hàng" value={province} onChange={(e) => pickProvince(e.target.value)} disabled={busy}>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input aria-label="Vĩ độ" value={lat} onChange={(e) => setLat(e.target.value)} disabled={busy} inputMode="decimal" />
            <input aria-label="Kinh độ" value={lng} onChange={(e) => setLng(e.target.value)} disabled={busy} inputMode="decimal" />
          </div>
          {!coordsOk && <div className="error">Toạ độ không hợp lệ (vĩ độ −90…90, kinh độ −180…180).</div>}
        </div>
      )}

      {needsConfirm && (
        <label className="driver-proof">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
          {mine.find((a) => a.confirm)?.confirm}
        </label>
      )}

      {all.length > 0 && !finished && (
        <div className="driver-actions">
          {all
            .filter((a) => a.roles.includes(role) || a.blocked)
            .map((a) => {
              const disabled =
                busy ||
                !!a.blocked ||
                (a.kind === "assign" && !coordsOk) ||
                (!!a.confirm && !confirmed);
              return (
                <button
                  key={a.id}
                  className="btn btn-primary"
                  disabled={disabled}
                  title={a.blocked}
                  onClick={() => (a.kind === "assign" ? onAssign(parcel, latN, lngN) : onStatusAction(parcel, a))}
                >
                  {busy && !a.blocked ? "Đang xử lý..." : a.label}
                </button>
              );
            })}
        </div>
      )}

      {all.filter((a) => a.blocked && a.roles.includes(role)).map((a) => (
        <div key={a.id} className="notice notice-warn">
          ⛔ “{a.label}” chưa thực hiện được: {a.blocked}
        </div>
      ))}

      {(finished || mine.length === 0) && (
        <div className="muted driver-wait">
          {finished
            ? "✓ Đơn đã kết thúc"
            : (OPS_WAITING_NOTE[parcel.currentStatus] ?? `Không có thao tác nào dành cho vai trò này ở trạng thái “${STATUS_LABEL[parcel.currentStatus]}”.`)}
        </div>
      )}

      {info && <div className="notice">{info}</div>}
      {error && (
        <div className="error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </li>
  );
}
