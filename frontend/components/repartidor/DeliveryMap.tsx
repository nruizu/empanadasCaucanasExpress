"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface DeliveryMapProps {
  storeLat: number;
  storeLng: number;
  storeName: string;
  destLat: number;
  destLng: number;
  destAddress: string;
}

export default function DeliveryMap({
  storeLat,
  storeLng,
  storeName,
  destLat,
  destLng,
  destAddress,
}: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    if (!mapRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([(storeLat + destLat) / 2, (storeLng + destLng) / 2], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const defaultIcon = L.divIcon({
      html: `<div style="background:#16a34a;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">T</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const destIcon = L.divIcon({
      html: `<div style="background:#dc2626;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">D</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([storeLat, storeLng], { icon: defaultIcon })
      .addTo(map)
      .bindPopup(`<b>${storeName}</b>`);

    L.marker([destLat, destLng], { icon: destIcon })
      .addTo(map)
      .bindPopup(`<b>Destino:</b> ${destAddress}`);

    const bounds = L.latLngBounds(
      [storeLat, storeLng],
      [destLat, destLng],
    );
    map.fitBounds(bounds, { padding: [50, 50] });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [storeLat, storeLng, storeName, destLat, destLng, destAddress]);

  return (
    <div
      ref={mapRef}
      className="h-64 w-full overflow-hidden rounded-lg border border-gray-200"
    />
  );
}
