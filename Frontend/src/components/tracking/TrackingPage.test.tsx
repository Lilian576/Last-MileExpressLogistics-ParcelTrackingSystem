import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Parcel } from "../../types/parcel";
import type { RealtimeHandlers } from "../../api/parcelApi";

const trackParcel = vi.fn();
const subscribe = vi.fn();

vi.mock("../../api/parcelApi", () => ({
  USE_MOCK: false,
  trackParcel: (c: string) => trackParcel(c) as Promise<Parcel | null>,
  subscribeToParcelRealtime: (...args: unknown[]) => subscribe(...args) as () => void,
}));
vi.mock("./DriverMap", () => ({ DriverMap: () => <div data-testid="map" /> }));

import { TrackingPage } from "./TrackingPage";

const PARCEL: Parcel = {
  trackingCode: "PCL1",
  sender: { fullName: "", phone: "", addressLine: "", province: "" },
  receiver: { fullName: "An", phone: "", addressLine: "", province: "" },
  packageInfo: { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, category: "OTHER" },
  feeVnd: 0,
  currentStatus: "IN_TRANSIT",
  history: [{ status: "CREATED", timestamp: "2026-01-01T00:00:00.000Z" }],
};

function renderPage(strict = false) {
  const ui = (
    <MemoryRouter initialEntries={["/tracking/PCL1"]}>
      <Routes>
        <Route path="/tracking/:code" element={<TrackingPage />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
}

beforeEach(() => {
  trackParcel.mockReset();
  subscribe.mockReset().mockReturnValue(() => {});
});

describe("TrackingPage", () => {
  it("mã không tồn tại -> báo rõ, không mở socket", async () => {
    trackParcel.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText(/Không tìm thấy đơn hàng/)).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("lỗi API -> hiện lỗi + nút Thử lại (không phải 'không tìm thấy')", async () => {
    trackParcel.mockRejectedValueOnce(new Error("Không kết nối được tới máy chủ."));
    renderPage();
    expect(await screen.findByText(/Không kết nối được tới máy chủ/)).toBeInTheDocument();
    expect(screen.queryByText(/Không tìm thấy đơn hàng/)).not.toBeInTheDocument();

    trackParcel.mockResolvedValueOnce(PARCEL);
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("PCL1")).toBeInTheDocument();
  });

  it("StrictMode (effect chạy 2 lần) vẫn chỉ mở đúng 1 subscription", async () => {
    trackParcel.mockResolvedValue(PARCEL);
    renderPage(true);
    await screen.findByText("PCL1");
    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
  });

  it("mất kết nối -> cảnh báo + giữ vị trí gần nhất đã nhận", async () => {
    trackParcel.mockResolvedValue(PARCEL);
    renderPage();
    await screen.findByText("PCL1");
    const handlers = subscribe.mock.calls[0][2] as RealtimeHandlers;

    act(() => {
      handlers.onConnectionChange?.(true);
      handlers.onLocation?.({ trackingCode: "PCL1", latitude: 10.77, longitude: 106.7, timestamp: "2026-01-01T02:00:00.000Z" });
    });
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.queryByText(/Mất kết nối real-time/)).not.toBeInTheDocument();

    act(() => handlers.onConnectionChange?.(false));
    expect(screen.getByText(/Mất kết nối real-time/)).toBeInTheDocument();
    expect(screen.getByText(/Vị trí gần nhất đã nhận/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });
});
