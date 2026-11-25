import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ParcelLocationUpdate } from "../../types/parcel";

// Bản đồ OpenStreetMap hiển thị vị trí tài xế. Dùng circleMarker thay cho icon
// mặc định của Leaflet (icon mặc định hay vỡ đường dẫn ảnh khi qua bundler).
export function DriverMap({ location }: { location: ParcelLocationUpdate }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current).setView([location.latitude, location.longitude], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    marker.current = L.circleMarker([location.latitude, location.longitude], {
      radius: 9,
      color: "#fff",
      weight: 3,
      fillColor: "#d9480f",
      fillOpacity: 1,
    }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // chỉ khởi tạo 1 lần; vị trí mới được cập nhật ở effect bên dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pos: L.LatLngExpression = [location.latitude, location.longitude];
    marker.current?.setLatLng(pos);
    map.current?.panTo(pos);
  }, [location.latitude, location.longitude]);

  return <div ref={el} className="driver-map" role="img" aria-label="Bản đồ vị trí tài xế" />;
}
