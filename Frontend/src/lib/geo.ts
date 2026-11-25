// Backend (CreateParcelDto, calculate-fee) yêu cầu toạ độ lat/lng, còn form chỉ
// có "tỉnh/thành". Ta quy đổi tỉnh/thành -> toạ độ trung tâm (đủ cho tính phí
// theo khoảng cách và điều phối tài xế ở mức đồ án; chưa geocode theo số nhà).
export interface LatLng {
  lat: number;
  lng: number;
}

export const PROVINCE_COORDS: Record<string, LatLng> = {
  "TP. Hồ Chí Minh": { lat: 10.7769, lng: 106.7009 },
  "Hà Nội": { lat: 21.0285, lng: 105.8542 },
  "Đà Nẵng": { lat: 16.0544, lng: 108.2022 },
  "Cần Thơ": { lat: 10.0452, lng: 105.7469 },
  "Hải Phòng": { lat: 20.8449, lng: 106.6881 },
  "Bình Dương": { lat: 10.9804, lng: 106.6519 },
  "Đồng Nai": { lat: 10.9453, lng: 106.8243 },
  "Khánh Hòa": { lat: 12.2388, lng: 109.1967 },
};

export const PROVINCES = Object.keys(PROVINCE_COORDS);

export function provinceToLatLng(province: string): LatLng {
  const c = PROVINCE_COORDS[province];
  if (!c) throw new Error(`Chưa hỗ trợ tỉnh/thành "${province}".`);
  return c;
}

// Haversine (km) — cùng công thức với ParcelsService.calculateDistance ở backend
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function estimateDays(km: number): number {
  if (km <= 50) return 1;
  if (km <= 400) return 2;
  if (km <= 1000) return 3;
  return 4;
}
