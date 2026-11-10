import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { clearSession, getSession, saveSession } from "../../lib/session";

function app(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/new" element={<ProtectedRoute><div>TRANG-BAO-VE</div></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("xác thực khách (mock)", () => {
  it("chưa đăng nhập vào trang bảo vệ -> chuyển sang /login", async () => {
    app("/new");
    expect(screen.queryByText("TRANG-BAO-VE")).toBeNull();
    expect(await screen.findByRole("button", { name: /Đăng nhập/ })).toBeInTheDocument();
  });

  it("đã đăng nhập thì vào được trang bảo vệ", () => {
    saveSession({ accessToken: "t", user: { id: "u", fullName: "A", email: "a@b.vn", role: "customer" } });
    app("/new");
    expect(screen.getByText("TRANG-BAO-VE")).toBeInTheDocument();
  });

  it("đăng nhập sai mật khẩu báo lỗi và không lưu phiên", async () => {
    const user = userEvent.setup();
    app("/login");
    await user.type(screen.getByLabelText("Email"), "khach@demo.vn");
    await user.type(screen.getByLabelText("Mật khẩu"), "sai-mat-khau");
    await user.click(screen.getByRole("button", { name: /Đăng nhập/ }));
    expect(await screen.findByText(/không đúng/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
});

describe("session", () => {
  it("lưu, đọc, xoá; dữ liệu hỏng coi như chưa đăng nhập", () => {
    const s = { accessToken: "t", user: { id: "u", fullName: "A", email: "a@b.vn", role: "customer" } };
    saveSession(s);
    expect(getSession()).toEqual(s);
    clearSession();
    expect(getSession()).toBeNull();
    localStorage.setItem("lemail.customerSession", "{hỏng");
    expect(getSession()).toBeNull();
  });
});
