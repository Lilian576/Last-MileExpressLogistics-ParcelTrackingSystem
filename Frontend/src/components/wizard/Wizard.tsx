import { useState } from "react";
import { Address, PackageInfo, QuoteResponse } from "../../types/parcel";
import { createParcel, getQuote } from "../../api/parcelApi";
import { addMyTrackingCode } from "../../lib/myOrders";
import { StepSenderReceiver } from "./StepSenderReceiver";
import { StepPackageInfo } from "./StepPackageInfo";
import { StepReview } from "./StepReview";
import { StepSuccess } from "./StepSuccess";

const STEP_TITLES = ["Người gửi / nhận", "Kiện hàng", "Xác nhận & phí", "Hoàn tất"];

const emptyAddress: Address = { fullName: "", phone: "", addressLine: "", province: "" };
const emptyPackage: PackageInfo = {
  weightKg: 0,
  lengthCm: 0,
  widthCm: 0,
  heightCm: 0,
  category: "OTHER",
  note: "",
};

export function Wizard() {
  const [step, setStep] = useState(0); // 0..3
  const [sender, setSender] = useState<Address>(emptyAddress);
  const [receiver, setReceiver] = useState<Address>(emptyAddress);
  const [packageInfo, setPackageInfo] = useState<PackageInfo>(emptyPackage);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  function updateAddress(which: "sender" | "receiver", field: keyof Address, value: string) {
    const setter = which === "sender" ? setSender : setReceiver;
    setter((prev) => ({ ...prev, [field]: value }));
  }

  function updatePackage(field: keyof PackageInfo, value: string | number) {
    setPackageInfo((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep0(): boolean {
    const e: Record<string, string> = {};
    for (const [prefix, addr] of [
      ["sender", sender],
      ["receiver", receiver],
    ] as const) {
      if (!addr.fullName.trim()) e[`${prefix}.fullName`] = "Vui lòng nhập họ tên";
      if (!/^0\d{9}$/.test(addr.phone)) e[`${prefix}.phone`] = "SĐT không hợp lệ (VD: 0901234567)";
      if (!addr.province) e[`${prefix}.province`] = "Vui lòng chọn tỉnh/thành";
      if (!addr.addressLine.trim()) e[`${prefix}.addressLine`] = "Vui lòng nhập địa chỉ";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (packageInfo.weightKg <= 0) e.weightKg = "Cân nặng phải > 0";
    if (packageInfo.lengthCm <= 0) e.lengthCm = "Bắt buộc > 0";
    if (packageInfo.widthCm <= 0) e.widthCm = "Bắt buộc > 0";
    if (packageInfo.heightCm <= 0) e.heightCm = "Bắt buộc > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function goNext() {
    if (step === 0) {
      if (!validateStep0()) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      setLoadingQuote(true);
      setQuoteError(null);
      try {
        const q = await getQuote({ sender, receiver, packageInfo });
        setQuote(q);
      } catch (err) {
        setQuoteError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoadingQuote(false);
      }
      return;
    }
    if (step === 2) {
      if (!quote) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const parcel = await createParcel({ sender, receiver, packageInfo, feeVnd: quote.feeVnd });
        addMyTrackingCode(parcel.trackingCode);
        setTrackingCode(parcel.trackingCode);
        setStep(3);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setSubmitting(false);
      }
    }
  }

  function goBack() {
    if (step > 0 && step < 3) setStep(step - 1);
  }

  return (
    <div className="paper-card">
      <div className="stepper">
        {STEP_TITLES.map((title, i) => (
          <div key={title} className={`step ${i === step ? "active" : i < step ? "done" : ""}`}>
            {i + 1}. {title}
          </div>
        ))}
      </div>

      {step === 0 && (
        <StepSenderReceiver sender={sender} receiver={receiver} errors={errors} onChange={updateAddress} />
      )}
      {step === 1 && <StepPackageInfo value={packageInfo} errors={errors} onChange={updatePackage} />}
      {step === 2 && (
        <StepReview
          sender={sender}
          receiver={receiver}
          packageInfo={packageInfo}
          quote={quote}
          loadingQuote={loadingQuote}
          quoteError={quoteError}
        />
      )}
      {step === 3 && trackingCode && <StepSuccess trackingCode={trackingCode} />}

      {step < 3 && (
        <div className="actions-row">
          <button className="btn" onClick={goBack} disabled={step === 0}>
            ← Quay lại
          </button>
          <button
            className="btn btn-primary"
            onClick={goNext}
            disabled={loadingQuote || submitting || (step === 2 && !quote)}
          >
            {step === 2 ? (submitting ? "Đang đặt đơn..." : "Xác nhận đặt đơn") : "Tiếp tục →"}
          </button>
        </div>
      )}
      {submitError && <div className="error" style={{ marginTop: 10 }}>{submitError}</div>}
    </div>
  );
}
