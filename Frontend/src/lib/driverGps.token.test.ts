import { describe, expect, it, vi } from "vitest";

// Backend (fix/m2-backend) chỉ nhận `driver:location` khi handshake có auth.token = JWT tài xế
describe("useDriverGps (backend thật)", () => {
  it("mở socket kèm auth.token của tài xế và gửi đúng payload", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    const emit = vi.fn();
    const ioMock = vi.fn(() => ({ emit, disconnect: vi.fn() }));
    vi.doMock("socket.io-client", () => ({ io: ioMock }));
    const { renderHook } = await import("@testing-library/react");
    const { useDriverGps } = await import("./driverGps");
    const parcels = [{ id: "1", trackingCode: "PCL1", currentStatus: "IN_TRANSIT" }] as never;

    const { unmount } = renderHook(() => useDriverGps(parcels, true, "jwt-tai-xe"));

    const opts = (ioMock.mock.calls[0] as unknown[])[1] as { auth: { token: string } };
    expect(opts.auth.token).toBe("jwt-tai-xe");
    const [event, payload] = emit.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe("driver:location");
    expect(payload).toMatchObject({ trackingCode: "PCL1" });
    expect(typeof payload.latitude).toBe("number");
    unmount();
    vi.unstubAllEnvs();
  });
});
