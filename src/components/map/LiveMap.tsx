'use client';

import React, { useEffect, useRef } from 'react';

interface LocationPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
}

interface LiveMapProps {
  locations: LocationPin[];
  center?: [number, number];
  zoom?: number;
}

export default function LiveMap({ locations, center = [19.0760, 72.8777], zoom = 12 }: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      // Load Leaflet CSS dynamically if not present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;

      if (!isMounted) return;

      // Initialize map instance if not initialized
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current).setView(
          locations.length > 0 ? [locations[0].latitude, locations[0].longitude] : center,
          zoom
        );

        // OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      // Custom Neumorphic / Accent Marker Icon
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: #6C63FF;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(108, 99, 255, 0.4);
          animation: pulse-ring 2s infinite;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      // Add markers
      const bounds = L.latLngBounds([]);

      locations.forEach((loc) => {
        if (loc.latitude && loc.longitude) {
          const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon }).addTo(map);
          marker.bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #0F172A; font-size: 14px;">${loc.title}</strong>
              ${loc.subtitle ? `<p style="color: #64748B; font-size: 12px; margin: 4px 0 0 0;">${loc.subtitle}</p>` : ''}
            </div>
          `);
          bounds.extend([loc.latitude, loc.longitude]);
        }
      });

      if (locations.length > 0 && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [locations, center, zoom]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] z-0" />
    </div>
  );
}
