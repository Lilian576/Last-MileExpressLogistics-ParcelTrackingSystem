import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Wizard } from "./Wizard";

describe("Wizard", () => {
  it("báo lỗi khi bước 1 để trống", async () => {
    render(<MemoryRouter><Wizard /></MemoryRouter>);
    await userEvent.click(screen.getByText(/Tiếp tục/));
    expect((await screen.findAllByText("Vui lòng nhập họ tên")).length).toBe(2);
  });

  it("đi hết 4 bước và nhận mã vận đơn (mock)", async () => {
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter><Wizard /></MemoryRouter>);

    const text = container.querySelectorAll<HTMLInputElement>("input");
    const selects = container.querySelectorAll<HTMLSelectElement>("select");
    // thứ tự: sender(name, phone, addr), receiver(name, phone, addr)
    await user.type(text[0], "Nguyen A");
    await user.type(text[1], "0901234567");
    await user.selectOptions(selects[0], "TP. Hồ Chí Minh");
    await user.type(text[2], "1 Le Loi");
    await user.type(text[3], "Tran B");
    await user.type(text[4], "0907654321");
    await user.selectOptions(selects[1], "Hà Nội");
    await user.type(text[5], "2 Hang Bai");
    await user.click(screen.getByText(/Tiếp tục/));

    const nums = container.querySelectorAll<HTMLInputElement>('input[type="number"]');
    for (const n of Array.from(nums)) await user.type(n, "2");
    await user.click(screen.getByText(/Tiếp tục/));

    const confirm = await screen.findByText("Xác nhận đặt đơn", {}, { timeout: 3000 });
    await waitFor(() => expect(confirm).toBeEnabled(), { timeout: 3000 }); // đợi tính phí xong
    await user.click(confirm);
    expect(await screen.findByText("Đặt đơn thành công!", {}, { timeout: 4000 })).toBeInTheDocument();
  }, 15000);
});
