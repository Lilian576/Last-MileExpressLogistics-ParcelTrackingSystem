import { MAIN_TIMELINE, ParcelEvent, ParcelStatus, STATUS_LABEL } from "../../types/parcel";

interface Props {
  history: ParcelEvent[];
  currentStatus: ParcelStatus;
}

const BRANCH_STATUSES: ParcelStatus[] = ["FAILED_DELIVERY", "RESCHEDULED", "RETURNED"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Timeline({ history, currentStatus }: Props) {
  const doneStatuses = new Set(history.map((h) => h.status));
  const eventFor = (s: ParcelStatus) => history.find((h) => h.status === s);

  // Timeline chính: luôn hiển thị đủ các mốc happy-path, kể cả chưa tới
  const mainItems = MAIN_TIMELINE.map((status) => ({
    status,
    event: eventFor(status),
    isDone: doneStatuses.has(status),
    isCurrent: status === currentStatus,
  }));

  // Nếu đơn từng rẽ nhánh (fail/reschedule/return), hiển thị thêm bên dưới theo thứ tự thời gian
  const branchEvents = history.filter((h) => BRANCH_STATUSES.includes(h.status));

  return (
    <ul className="timeline">
      {mainItems.map(({ status, event, isDone, isCurrent }) => {
        // Nếu đơn đã rẽ sang FAILED_DELIVERY, DELIVERED sẽ không xảy ra nữa -> đừng tô "current"
        const skip = status === "DELIVERED" && branchEvents.length > 0 && !isDone;
        return (
          <li
            key={status}
            className={`timeline-item ${isDone ? "done" : ""} ${isCurrent && !skip ? "current" : ""}`}
          >
            <span className="timeline-dot" />
            <div className="timeline-status">{STATUS_LABEL[status]}</div>
            <div className="timeline-time">{event ? formatTime(event.timestamp) : "Chưa tới"}</div>
          </li>
        );
      })}

      {branchEvents.map((event) => (
        <li key={event.status + event.timestamp} className="timeline-item branch current">
          <span className="timeline-dot" />
          <div className="timeline-status">⚠ {STATUS_LABEL[event.status]}</div>
          <div className="timeline-time">{formatTime(event.timestamp)}</div>
        </li>
      ))}
    </ul>
  );
}
