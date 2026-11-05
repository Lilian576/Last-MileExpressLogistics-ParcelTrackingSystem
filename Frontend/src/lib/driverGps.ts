import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_URL, USE_MOCK } from "../api/parcelApi";
import { mockEmitLocation } from "../api/mockBackend";
import { DriverParcel } from "../types/driver";
import { ParcelStatus } from "../types/parcel";
import { getDriverSession } from "./driverSession";

export const GPS_INTERVAL_MS = 4000;

// Tài xế chỉ phát vị trí khi đơn đang trên đường (đã lấy hàng, chưa kết thúc)
const MOVING: ParcelStatus[] = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];

export type GpsSource = "gps" | "simulated";

// Điểm xuất phát giả lập (trung tâm TP.HCM) + bước ngẫu nhiên nhỏ mỗi lần phát
const SIM_START = { lat: 10.7769, lng: 106.7009 };
export function nextSimulated(prev: { lat: number; lng: number }, rnd: () => number = Math.random) {
  return { lat: prev.lat + (rnd() - 0.4) * 0.0008, lng: prev.lng + (rnd() - 0.3) * 0.0008 };
}

// Gửi `driver:location` { trackingCode, latitude, longitude } mỗi GPS_INTERVAL_MS cho từng
// đơn đang giao. Dùng GPS thật của trình duyệt (navigator.geolocation); nếu không có/bị từ
// chối thì giả lập đường đi để demo. Server phát lại thành `parcel.location.updated`.
export function useDriverGps(parcels: DriverParcel[] | null, enabled: boolean) {
  const [source, setSource] = useState<GpsSource>("simulated");
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const codesRef = useRef<string[]>([]);
  codesRef.current = (parcels ?? []).filter((p) => MOVING.includes(p.currentStatus)).map((p) => p.trackingCode);
  const hasActive = codesRef.current.length > 0;

  useEffect(() => {
    if (!enabled || !hasActive) return;

    let socket: Socket | null = null;
    // Server yêu cầu JWT shipper để nhận driver:location (xem TrackingGateway)
    if (!USE_MOCK) {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        auth: { token: getDriverSession()?.accessToken },
      });
    }

    let fix: { lat: number; lng: number } | null = null;
    let sim = { ...SIM_START };
    const watchId =
      typeof navigator !== "undefined" && navigator.geolocation
        ? navigator.geolocation.watchPosition(
            (pos) => {
              fix = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              setSource("gps");
            },
            () => {
              fix = null; // bị từ chối / lỗi -> quay lại giả lập
              setSource("simulated");
            },
            { enableHighAccuracy: true, maximumAge: 5000 }
          )
        : null;

    const tick = () => {
      let pos = fix;
      if (!pos) {
        sim = nextSimulated(sim);
        pos = sim;
      }
      for (const trackingCode of codesRef.current) {
        if (socket) socket.emit("driver:location", { trackingCode, latitude: pos.lat, longitude: pos.lng });
        else mockEmitLocation(trackingCode, pos.lat, pos.lng);
      }
      setLastSent(new Date());
    };
    tick();
    const timer = setInterval(tick, GPS_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      socket?.disconnect();
    };
  }, [enabled, hasActive]);

  return { source, lastSent, active: enabled && hasActive };
}
