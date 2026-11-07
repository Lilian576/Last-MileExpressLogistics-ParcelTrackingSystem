// Ánh xạ giữa kiểu của UI (types/parcel.ts) và hợp đồng REST của backend thật
// (backend/src/parcels). Tách thuần hàm để test được mà không cần mạng.
import {
  CreateParcelRequest,
  Parcel,
  ParcelEvent,
  ParcelStatus,
  QuoteRequest,
  QuoteResponse,
} from "../types/parcel";
import { PROVINCES, distanceKm, estimateDays, provinceToLatLng } from "../lib/geo";

// Khớp CreateParcelDto / CalculateFeeDto ở backend
export interface BackendFeeRequest {
  weightKg: number;
  senderLat: number;
  senderLng: number;
  receiverLat: number;
  receiverLng: number;
}

export interface BackendCreateParcel extends BackendFeeRequest {
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
}

// Giá trị cố định của pricing engine (ParcelsService) — chỉ dùng để DIỄN GIẢI
// breakdown trên UI; số tiền cuối cùng luôn lấy từ backend.
const BASE_FEE = 15000;
const PRICE_PER_KG = 5000;

export function toFeeRequest(req: QuoteRequest): BackendFeeRequest {
  const from = provinceToLatLng(req.sender.province);
  const to = provinceToLatLng(req.receiver.province);
  return {
    weightKg: req.packageInfo.weightKg,
    senderLat: from.lat,
    senderLng: from.lng,
    receiverLat: to.lat,
    receiverLng: to.lng,
  };
}

export function toCreateParcelDto(req: CreateParcelRequest): BackendCreateParcel {
  return {
    ...toFeeRequest(req),
    receiverName: req.receiver.fullName.trim(),
    receiverPhone: req.receiver.phone,
    // Backend chỉ có 1 cột địa chỉ -> ghép cả tỉnh/thành để không mất thông tin
    receiverAddress: `${req.receiver.addressLine.trim()}, ${req.receiver.province}`,
  };
}

// POST /api/parcels/calculate-fee trả { fee, currency, details } -> QuoteResponse của UI
export function toQuoteResponse(req: QuoteRequest, res: { fee: number }): QuoteResponse {
  const km = distanceKm(provinceToLatLng(req.sender.province), provinceToLatLng(req.receiver.province));
  const weightFee = Math.round(req.packageInfo.weightKg * PRICE_PER_KG);
  // Phí khoảng cách = phần còn lại, để tổng breakdown luôn khớp đúng số backend trả về
  const distanceFee = res.fee - BASE_FEE - weightFee;
  return {
    feeVnd: res.fee,
    estimatedDays: estimateDays(km),
    breakdown: [
      { label: "Phí cơ bản", amountVnd: BASE_FEE },
      { label: `Phí trọng lượng (${req.packageInfo.weightKg}kg)`, amountVnd: weightFee },
      { label: `Phí khoảng cách (~${Math.round(km)}km)`, amountVnd: distanceFee },
    ],
  };
}

// Dạng Parcel backend trả về (Prisma): Decimal -> string, Date -> ISO string
export interface BackendParcel {
  id: string;
  trackingCode: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: number | string;
  currentStatus: ParcelStatus;
  createdAt: string;
  fee?: number;
  statusHistory?: { status: ParcelStatus; createdAt: string; note?: string | null }[];
}

// "12 Lê Lợi, TP. Hồ Chí Minh" -> { addressLine: "12 Lê Lợi", province: "TP. Hồ Chí Minh" }
export function splitAddress(full: string): { addressLine: string; province: string } {
  const idx = full.lastIndexOf(", ");
  if (idx >= 0) {
    const tail = full.slice(idx + 2).trim();
    if (PROVINCES.includes(tail)) return { addressLine: full.slice(0, idx), province: tail };
  }
  return { addressLine: full, province: "" };
}

export function fromBackendParcel(p: BackendParcel, senderName = ""): Parcel {
  const { addressLine, province } = splitAddress(p.receiverAddress);
  const history: ParcelEvent[] = (p.statusHistory ?? []).map((h) => ({
    status: h.status,
    timestamp: h.createdAt,
    ...(h.note ? { note: h.note } : {}),
  }));
  // create() chưa ghi mốc CREATED vào lịch sử -> bổ sung từ createdAt (giống tra cứu công khai)
  if (history[0]?.status !== "CREATED") history.unshift({ status: "CREATED", timestamp: p.createdAt });
  return {
    trackingCode: p.trackingCode,
    sender: { fullName: senderName, phone: "", addressLine: "", province: "" },
    receiver: { fullName: p.receiverName, phone: p.receiverPhone, addressLine, province },
    packageInfo: { weightKg: Number(p.weightKg), lengthCm: 0, widthCm: 0, heightCm: 0, category: "OTHER" },
    feeVnd: p.fee ?? 0, // backend chưa lưu phí vào DB (xem báo cáo, việc của M2) -> 0 = chưa biết
    currentStatus: p.currentStatus,
    history,
  };
}
