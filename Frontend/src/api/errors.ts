// Token hết hạn / không hợp lệ (HTTP 401) -> UI đưa tài xế về trang đăng nhập
export class AuthExpiredError extends Error {
  constructor(message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}
