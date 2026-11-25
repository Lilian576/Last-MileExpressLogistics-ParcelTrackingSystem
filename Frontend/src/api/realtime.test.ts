import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => void;

function makeSocket() {
  const handlers = new Map<string, Handler[]>();
  const socket = {
    connected: true,
    on: vi.fn((ev: string, cb: Handler) => {
      handlers.set(ev, [...(handlers.get(ev) ?? []), cb]);
      return socket;
    }),
    off: vi.fn(() => {
      handlers.clear();
      return socket;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    fire: (ev: string, ...args: unknown[]) => handlers.get(ev)?.forEach((h) => h(...args)),
    listenerCount: () => [...handlers.values()].reduce((n, l) => n + l.length, 0),
  };
  return socket;
}

const SNAPSHOT = {
  trackingCode: "PCL1",
  currentStatus: "CREATED",
  receiverName: "An",
  history: [{ status: "CREATED", timestamp: "2026-01-01T00:00:00.000Z" }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let socket: ReturnType<typeof makeSocket>;
let ioMock: ReturnType<typeof vi.fn>;

async function load() {
  vi.resetModules();
  vi.stubEnv("VITE_USE_MOCK", "false");
  socket = makeSocket();
  ioMock = vi.fn(() => socket);
  vi.doMock("socket.io-client", () => ({ io: ioMock }));
  return import("./parcelApi");
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => json(SNAPSHOT)));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("trackParcel (backend thật)", () => {
  it("404 -> null (mã không tồn tại)", async () => {
    const api = await load();
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "x" }, 404)));
    expect(await api.trackParcel("NOPE")).toBeNull();
  });

  it("5xx -> ném lỗi có thông báo từ server", async () => {
    const api = await load();
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Lỗi nội bộ" }, 500)));
    await expect(api.trackParcel("PCL1")).rejects.toThrow("Lỗi nội bộ");
  });

  it("không kết nối được -> thông báo mất mạng, không phải 'không tìm thấy'", async () => {
    const api = await load();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api.trackParcel("PCL1")).rejects.toThrow("Không kết nối được tới máy chủ");
  });
});

describe("subscribeToParcelRealtime", () => {
  const initial = () => ({
    trackingCode: "PCL1",
    sender: { fullName: "", phone: "", addressLine: "", province: "" },
    receiver: { fullName: "An", phone: "", addressLine: "", province: "" },
    packageInfo: { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, category: "OTHER" as const },
    feeVnd: 0,
    currentStatus: "CREATED" as const,
    history: [{ status: "CREATED" as const, timestamp: "2026-01-01T00:00:00.000Z" }],
  });

  it("chỉ mở 1 socket cho cả trạng thái lẫn vị trí, listener đăng ký đúng 1 lần dù reconnect", async () => {
    const api = await load();
    api.subscribeToParcelRealtime("PCL1", initial(), { onParcel: vi.fn(), onLocation: vi.fn() });
    expect(ioMock).toHaveBeenCalledTimes(1);
    const before = socket.listenerCount();

    socket.fire("connect");
    socket.fire("disconnect");
    socket.fire("connect"); // reconnect

    expect(socket.listenerCount()).toBe(before); // không nhân đôi listener
    const joins = socket.emit.mock.calls.filter((c) => c[0] === "join:parcel");
    expect(joins).toHaveLength(2); // join lại room sau mỗi lần connect
  });

  it("resync snapshot REST sau mỗi lần (re)connect và báo kết quả đồng bộ", async () => {
    const api = await load();
    const onSync = vi.fn();
    api.subscribeToParcelRealtime("PCL1", initial(), { onParcel: vi.fn(), onSync });
    socket.fire("connect");
    await vi.waitFor(() => expect(onSync).toHaveBeenCalledWith(expect.objectContaining({ ok: true })));

    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "down" }, 503)));
    socket.fire("connect");
    await vi.waitFor(() => expect(onSync).toHaveBeenLastCalledWith({ ok: false, message: "down" }));
  });

  it("ghép bản vá trạng thái, định tuyến vị trí, bỏ qua mã khác", async () => {
    const api = await load();
    const onParcel = vi.fn();
    const onLocation = vi.fn();
    const onConnectionChange = vi.fn();
    api.subscribeToParcelRealtime("PCL1", initial(), { onParcel, onLocation, onConnectionChange });

    socket.fire("parcel.status.updated", {
      trackingCode: "PCL1",
      currentStatus: "PENDING_PICKUP",
      event: { status: "PENDING_PICKUP", timestamp: "2026-01-01T01:00:00.000Z" },
    });
    expect(onParcel).toHaveBeenLastCalledWith(expect.objectContaining({ currentStatus: "PENDING_PICKUP" }));

    socket.fire("parcel.location.updated", { trackingCode: "OTHER", latitude: 1, longitude: 2, timestamp: "t" });
    expect(onLocation).not.toHaveBeenCalled();
    socket.fire("parcel.location.updated", { trackingCode: "PCL1", latitude: 10, longitude: 106, timestamp: "t" });
    expect(onLocation).toHaveBeenCalledTimes(1);

    socket.fire("disconnect");
    expect(onConnectionChange).toHaveBeenLastCalledWith(false);
  });

  it("payload trạng thái sai dạng -> không làm hỏng state, tải lại snapshot REST", async () => {
    const api = await load();
    const onParcel = vi.fn();
    api.subscribeToParcelRealtime("PCL1", initial(), { onParcel });
    const fetchMock = vi.mocked(fetch);
    const before = fetchMock.mock.calls.length;

    socket.fire("parcel.status.updated", { trackingCode: "PCL1", status: "Received", updatedAt: "2026-01-01T03:00:00.000Z" });

    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 1));
    expect(onParcel).not.toHaveBeenCalledWith(expect.objectContaining({ currentStatus: undefined }));
  });

  it("cleanup rời room, gỡ toàn bộ listener và đóng socket", async () => {
    const api = await load();
    const cleanup = api.subscribeToParcelRealtime("PCL1", initial(), { onParcel: vi.fn() });
    cleanup();
    expect(socket.emit).toHaveBeenCalledWith("leave:parcel", { trackingCode: "PCL1" });
    expect(socket.off).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.listenerCount()).toBe(0);
  });
});
