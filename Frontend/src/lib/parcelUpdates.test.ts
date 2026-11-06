import { describe, expect, it } from "vitest";
import { applyStatusUpdate, isSnapshotFresh } from "./parcelUpdates";
import { Parcel } from "../types/parcel";

const base: Parcel = {
  trackingCode: "PCL1",
  sender: { fullName: "", phone: "", addressLine: "", province: "" },
  receiver: { fullName: "B", phone: "", addressLine: "", province: "" },
  packageInfo: { weightKg: 1, lengthCm: 1, widthCm: 1, heightCm: 1, category: "OTHER" },
  feeVnd: 0,
  currentStatus: "CREATED",
  history: [{ status: "CREATED", timestamp: "2026-01-01T00:00:00.000Z" }],
};
const update = {
  trackingCode: "PCL1",
  currentStatus: "PICKED_UP" as const,
  event: { status: "PICKED_UP" as const, timestamp: "2026-01-01T01:00:00.000Z" },
};

describe("applyStatusUpdate", () => {
  it("ghép trạng thái mới và mốc lịch sử", () => {
    const r = applyStatusUpdate(base, update);
    expect(r.currentStatus).toBe("PICKED_UP");
    expect(r.history).toHaveLength(2);
  });
  it("idempotent khi nhận trùng event", () => {
    const once = applyStatusUpdate(base, update);
    expect(applyStatusUpdate(once, update).history).toHaveLength(2);
  });
});

describe("isSnapshotFresh", () => {
  it("bỏ snapshot cũ hơn dữ liệu realtime", () => {
    const newer = applyStatusUpdate(base, update);
    expect(isSnapshotFresh(base, newer)).toBe(false);
    expect(isSnapshotFresh(newer, base)).toBe(true);
    expect(isSnapshotFresh(base, null)).toBe(true);
  });
});
