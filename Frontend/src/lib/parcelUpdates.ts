import { Parcel, ParcelStatusUpdate } from "../types/parcel";

// Ghép 1 bản vá realtime vào Parcel đang hiển thị. Idempotent: nhận trùng
// cùng 1 event (VD: do resync sau reconnect) thì không thêm dòng lịch sử lần 2.
export function applyStatusUpdate(parcel: Parcel, update: ParcelStatusUpdate): Parcel {
  const dup = parcel.history.some(
    (h) => h.status === update.event.status && h.timestamp === update.event.timestamp
  );
  return {
    ...parcel,
    currentStatus: update.currentStatus,
    history: dup ? parcel.history : [...parcel.history, update.event],
  };
}

function lastEventTime(p: Parcel): number {
  const last = p.history[p.history.length - 1];
  return last ? Date.parse(last.timestamp) : 0;
}

// Snapshot REST (sau reconnect) chỉ được ghi đè nếu không CŨ HƠN dữ liệu đang có,
// tránh bị "lùi trạng thái" khi event realtime đến trước khi REST trả về.
export function isSnapshotFresh(snapshot: Parcel, current: Parcel | null): boolean {
  return !current || lastEventTime(snapshot) >= lastEventTime(current);
}
