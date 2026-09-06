import { Link } from "react-router-dom";

interface Props {
  trackingCode: string;
}

export function StepSuccess({ trackingCode }: Props) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>Đặt đơn thành công!</h3>
      <p className="muted">Mã vận đơn của bạn:</p>
      <div className="tracking-code-stamp">{trackingCode}</div>
      <p className="muted" style={{ marginTop: 20 }}>
        Lưu lại mã này để theo dõi hành trình đơn hàng theo thời gian thực.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12, flexWrap: "wrap" }}>
        <Link to={`/tracking/${trackingCode}`}>
          <button className="btn btn-primary">Theo dõi đơn ngay →</button>
        </Link>
        <Link to="/orders">
          <button className="btn">Xem danh sách đơn</button>
        </Link>
      </div>
    </div>
  );
}
