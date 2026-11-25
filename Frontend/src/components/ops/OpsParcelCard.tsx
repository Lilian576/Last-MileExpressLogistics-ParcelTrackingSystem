import { useState } from "react";
import { Link } from "react-router-dom";
import { AssignCourierInput, OPS_ACTIONS, OPS_WAITING_NOTE, OpsHub, OpsParcel, OpsRole, OpsStatusUpdate } from "../../types/ops";
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
  hubs: OpsHub[];
  busy: boolean;
  error?: string;
  info?: string;
  onStatusAction: (parcel: OpsParcel, input: OpsStatusUpdate) => void;
  onAssign: (parcel: OpsParcel, input: AssignCourierInput) => void;
}

export function OpsParcelCard({ parcel, role, hubs, busy, error, info, onStatusAction, onAssign }: Props) {
  const [hubId, setHubId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [province, setProvince] = useState(PROVINCES[0]);
  const [lat, setLat] = useState(String(provinceToLatLng(PROVINCES[0]).lat));
  const [lng, setLng] = useState(String(provinceToLatLng(PROVINCES[0]).lng));

  const all = OPS_ACTIONS[parcel.currentStatus] ?? [];
  const atDestination = Boolean(parcel.currentLocationId && parcel.currentLocationId === parcel.destinationLocationId);
  const mine = all.filter((action) => {
    if (!action.roles.includes(role)) return false;
    if (action.kind === "assign") return true;
    if (action.event === "dispatch_last_mile") return atDestination;
    if (action.event === "dispatch_to_next_hub") return !atDestination;
    return true;
  });
  const finished = TERMINAL_STATUSES.includes(parcel.currentStatus);
  const confirmation = mine.find((action) => action.kind === "status" && action.confirm);
  const canAssign = mine.some((action) => action.kind === "assign");
  const canReceive = mine.some((action) => action.kind === "status" && action.event === "arrive_at_hub");
  const needsCoordinates = parcel.senderLat == null || parcel.senderLng == null;
  const selectedHub = hubs.find((hub) => hub.id === (hubId || parcel.destinationLocationId));

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

      {(canAssign || canReceive) && (
        <label className="ops-assign">
          {canAssign ? "Hub phụ trách giao hàng" : "Hub tiếp nhận"}
          <select value={selectedHub?.id ?? ""} onChange={(event) => setHubId(event.target.value)} disabled={busy}>
            <option value="">Chọn hub</option>
            {hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
          </select>
        </label>
      )}

      {canAssign && needsCoordinates && (
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

      {confirmation?.kind === "status" && (
        <label className="driver-proof">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />
          {confirmation.confirm}
        </label>
      )}

      {mine.length > 0 && !finished && (
        <div className="driver-actions">
          {mine.map((action) => {
            const input = action.kind === "assign"
              ? null
              : action.event === "arrive_at_hub"
                ? selectedHub && confirmed
                  ? { event: action.event, hubId: selectedHub.id } as const
                  : null
                : { event: action.event } as const;
            const disabled = busy || (action.kind === "assign"
              ? !selectedHub || (needsCoordinates && !coordsOk)
              : !input);
            return (
              <button
                key={action.id}
                className="btn btn-primary"
                disabled={disabled}
                onClick={() => {
                  if (action.kind === "assign" && selectedHub) {
                    onAssign(parcel, {
                      destinationHubId: selectedHub.id,
                      ...(needsCoordinates ? { pickupLat: latN, pickupLng: lngN } : {}),
                    });
                  } else if (input) {
                    onStatusAction(parcel, input);
                  }
                }}
              >
                {busy ? "Đang xử lý..." : action.label}
              </button>
            );
          })}
        </div>
      )}

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
