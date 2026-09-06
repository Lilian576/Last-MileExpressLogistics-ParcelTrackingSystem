// ============================================================================
// Lưu danh sách mã vận đơn mà khách đã tạo trên CHÍNH trình duyệt này.
//
// Vì AuthModule (M3) chưa xong ở Tuần 2, sender-app chưa đăng nhập được, nên
// "xem danh sách đơn" tạm thời hoạt động theo kiểu "khách vãng lai": mỗi khi
// tạo đơn thành công, ta lưu trackingCode vào localStorage. Khi có JWT auth
// thật (Tuần 3+), đổi listMyParcels() trong parcelApi.ts sang gọi thẳng
// GET /api/parcels/mine kèm Authorization header — không cần đổi UI.
// ============================================================================

const STORAGE_KEY = "lemail.myTrackingCodes";

export function getMyTrackingCodes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addMyTrackingCode(code: string): void {
  try {
    const current = getMyTrackingCodes();
    if (current.includes(code)) return;
    const next = [code, ...current]; // đơn mới nhất lên đầu
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage có thể bị chặn (private mode) — bỏ qua, không chặn luồng tạo đơn
  }
}
