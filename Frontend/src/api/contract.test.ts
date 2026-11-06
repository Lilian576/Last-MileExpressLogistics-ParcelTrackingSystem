import { describe, expect, it } from "vitest";
import { fromBackendParcel, splitAddress, toCreateParcelDto, toFeeRequest, toQuoteResponse } from "./contract";
import { CreateParcelRequest } from "../types/parcel";

const req: CreateParcelRequest = {
  sender: { fullName: "A", phone: "0901234567", addressLine: "1 Lê Lợi", province: "TP. Hồ Chí Minh" },
  receiver: { fullName: " B ", phone: "0907654321", addressLine: "2 Hàng Bài", province: "Hà Nội" },
  packageInfo: { weightKg: 2, lengthCm: 10, widthCm: 10, heightCm: 10, category: "OTHER" },
  feeVnd: 0,
};

describe("contract mapping", () => {
  it("toFeeRequest đổi tỉnh -> toạ độ", () => {
    const f = toFeeRequest(req);
    expect(f.weightKg).toBe(2);
    expect(f.senderLat).toBeCloseTo(10.78, 1);
    expect(f.receiverLat).toBeCloseTo(21.03, 1);
  });
  it("toCreateParcelDto đúng cấu trúc CreateParcelDto", () => {
    const d = toCreateParcelDto(req);
    expect(d.receiverName).toBe("B");
    expect(d.receiverAddress).toBe("2 Hàng Bài, Hà Nội");
    expect(Object.keys(d).sort()).toEqual(
      ["receiverAddress", "receiverLat", "receiverLng", "receiverName", "receiverPhone", "senderLat", "senderLng", "weightKg"].sort()
    );
  });
  it("breakdown luôn cộng đúng bằng phí backend", () => {
    const q = toQuoteResponse(req, { fee: 1234567 });
    expect(q.breakdown.reduce((s, b) => s + b.amountVnd, 0)).toBe(1234567);
    expect(q.estimatedDays).toBeGreaterThanOrEqual(3);
  });
  it("splitAddress tách tỉnh", () => {
    expect(splitAddress("12 A, Đà Nẵng")).toEqual({ addressLine: "12 A", province: "Đà Nẵng" });
    expect(splitAddress("12 A")).toEqual({ addressLine: "12 A", province: "" });
  });
  it("fromBackendParcel thêm mốc CREATED và ép weightKg sang số", () => {
    const p = fromBackendParcel({
      id: "1", trackingCode: "PCL1", receiverName: "B", receiverPhone: "09", receiverAddress: "x, Hà Nội",
      weightKg: "2.5", currentStatus: "CREATED", createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(p.history[0].status).toBe("CREATED");
    expect(p.packageInfo.weightKg).toBe(2.5);
    expect(p.receiver.province).toBe("Hà Nội");
  });
});
