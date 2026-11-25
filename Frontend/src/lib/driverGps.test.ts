import { describe, expect, it } from "vitest";
import { nextSimulated } from "./driverGps";

describe("nextSimulated", () => {
  it("di chuyển một bước nhỏ, không nhảy xa", () => {
    const p = nextSimulated({ lat: 10, lng: 106 }, () => 0.9);
    expect(Math.abs(p.lat - 10)).toBeLessThan(0.001);
    expect(p.lat).not.toBe(10);
  });
});
