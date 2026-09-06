import { Address, PackageInfo, QuoteResponse } from "../../types/parcel";

interface Props {
  sender: Address;
  receiver: Address;
  packageInfo: PackageInfo;
  quote: QuoteResponse | null;
  loadingQuote: boolean;
  quoteError: string | null;
}

function formatVnd(n: number) {
  return n.toLocaleString("vi-VN") + "đ";
}

export function StepReview({ sender, receiver, packageInfo, quote, loadingQuote, quoteError }: Props) {
  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 12 }}>
        Xác nhận thông tin đơn hàng
      </h3>

      <div className="field-row">
        <div>
          <div className="muted">Người gửi</div>
          <div>{sender.fullName} · {sender.phone}</div>
          <div className="muted">{sender.addressLine}, {sender.province}</div>
        </div>
        <div>
          <div className="muted">Người nhận</div>
          <div>{receiver.fullName} · {receiver.phone}</div>
          <div className="muted">{receiver.addressLine}, {receiver.province}</div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="muted">Kiện hàng</div>
        <div>
          {packageInfo.weightKg}kg · {packageInfo.lengthCm}×{packageInfo.widthCm}×{packageInfo.heightCm}cm
        </div>
        {packageInfo.note && <div className="muted">Ghi chú: {packageInfo.note}</div>}
      </div>

      <div className="fee-box">
        {loadingQuote && <div className="muted">Đang tính phí ship...</div>}
        {quoteError && <div className="error">{quoteError}</div>}
        {quote && !loadingQuote && (
          <>
            <div className="muted" style={{ marginBottom: 6 }}>
              Dự kiến giao trong {quote.estimatedDays} ngày
            </div>
            {quote.breakdown.map((b) => (
              <div className="fee-line" key={b.label}>
                <span>{b.label}</span>
                <span>{formatVnd(b.amountVnd)}</span>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              Tổng phí: <span className="fee-total">{formatVnd(quote.feeVnd)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
