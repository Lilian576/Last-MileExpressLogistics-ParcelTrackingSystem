import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OpsParcelCard } from "./OpsParcelCard";
import type { OpsParcel, OpsRole } from "../../types/ops";
import type { ParcelStatus } from "../../types/parcel";

const parcel = (currentStatus: ParcelStatus): OpsParcel => ({
  id: "id-1",
  trackingCode: "PCL1",
  receiverName: "An",
  receiverPhone: "0900000000",
  receiverAddress: "12 Lê Lợi, TP. Hồ Chí Minh",
  weightKg: "1.5",
  currentStatus,
  createdAt: "2026-01-01T00:00:00.000Z",
  senderLat: null,
  senderLng: null,
  currentLocationId: null,
  destinationLocationId: null,
});

function setup(status: ParcelStatus, role: OpsRole, overrides: Partial<OpsParcel> = {}) {
  const onStatusAction = vi.fn();
  const onAssign = vi.fn();
  render(
    <MemoryRouter>
      <ul>
        <OpsParcelCard parcel={{ ...parcel(status), ...overrides }} role={role} hubs={[{ id: "hub-1", name: "Hub 1", address: "Quận 7" }]} busy={false} onStatusAction={onStatusAction} onAssign={onAssign} />
      </ul>
    </MemoryRouter>
  );
  return { onStatusAction, onAssign };
}

describe("OpsParcelCard — thao tác theo trạng thái và quyền", () => {
  it("CREATED: admin thấy nút gán tài xế và gửi đúng toạ độ", async () => {
    const { onAssign } = setup("CREATED", "admin");
    const button = screen.getByRole("button", { name: "Gán tài xế gần nhất" });
    expect(button).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Hub phụ trách giao hàng"), "hub-1");
    await userEvent.click(button);
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "id-1" }), {
      destinationHubId: "hub-1", pickupLat: 10.7769, pickupLng: 106.7009,
    });
  });

  it("đơn có tọa độ đã lưu chỉ gửi hub đích", async () => {
    const { onAssign } = setup("CREATED", "admin", { senderLat: "10.5", senderLng: "106.7" });
    expect(screen.queryByLabelText("Vĩ độ")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Hub phụ trách giao hàng"), "hub-1");
    await userEvent.click(screen.getByRole("button", { name: "Gán tài xế gần nhất" }));
    expect(onAssign).toHaveBeenCalledWith(expect.anything(), { destinationHubId: "hub-1" });
  });

  it("CREATED: nhân viên kho KHÔNG có thao tác gán tài xế", () => {
    setup("CREATED", "warehouse_staff");
    expect(screen.queryByRole("button", { name: "Gán tài xế gần nhất" })).not.toBeInTheDocument();
    expect(screen.getByText(/Không có thao tác nào dành cho vai trò này/)).toBeInTheDocument();
  });

  it("toạ độ không hợp lệ -> khóa nút gán", async () => {
    setup("CREATED", "admin");
    await userEvent.selectOptions(screen.getByLabelText("Hub phụ trách giao hàng"), "hub-1");
    const lat = screen.getByLabelText("Vĩ độ");
    await userEvent.clear(lat);
    await userEvent.type(lat, "999");
    expect(screen.getByRole("button", { name: "Gán tài xế gần nhất" })).toBeDisabled();
  });

  it("IN_TRANSIT: tiếp nhận tại hub chỉ mở sau khi xác nhận đã quét", async () => {
    const { onStatusAction } = setup("IN_TRANSIT", "warehouse_staff");
    const btn = screen.getByRole("button", { name: "Tiếp nhận tại hub" });
    expect(btn).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Hub tiếp nhận"), "hub-1");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(btn);
    expect(onStatusAction).toHaveBeenCalledWith(expect.anything(), { event: "arrive_at_hub", hubId: "hub-1" });
  });

  it("IN_TRANSIT: admin không thấy thao tác tiếp nhận hub", () => {
    setup("IN_TRANSIT", "admin");
    expect(screen.queryByRole("button", { name: "Tiếp nhận tại hub" })).not.toBeInTheDocument();
  });

  it("AT_HUB: nhân viên kho chỉ có thao tác chuyển hub, không có điều phối chặng cuối", () => {
    setup("AT_HUB", "warehouse_staff");
    expect(screen.getByRole("button", { name: "Chuyển sang hub tiếp theo" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Điều phối giao chặng cuối" })).not.toBeInTheDocument();
  });

  it("AT_HUB: admin (kiêm điều phối) gửi dispatch_last_mile khi đơn ở hub đích", async () => {
    const { onStatusAction } = setup("AT_HUB", "admin", { currentLocationId: "hub-1", destinationLocationId: "hub-1" });
    expect(screen.queryByRole("button", { name: "Chuyển sang hub tiếp theo" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Điều phối giao chặng cuối" }));
    expect(onStatusAction).toHaveBeenCalledWith(
      expect.anything(),
      { event: "dispatch_last_mile" }
    );
  });

  it("đơn đã kết thúc không có thao tác", () => {
    setup("DELIVERED", "admin");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
