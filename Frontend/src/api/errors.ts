// Token hết hạn / không hợp lệ (HTTP 401) -> UI đưa tài xế về trang đăng nhập
export class AuthExpiredError extends Error {
  constructor(message = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

// Lấy thông báo lỗi từ response NestJS: { statusCode, message: string | string[], error }.
// 401 -> AuthExpiredError để UI đưa người dùng về trang đăng nhập.
export async function readError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) return new AuthExpiredError();
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    if (msg) return new Error(msg);
  } catch {
    // body không phải JSON -> dùng fallback
  }
  return new Error(fallback);
}
