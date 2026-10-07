import React, { useEffect, useState, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair } from 'lucide-react';
import { NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM } from '../../lib/geo/nigeriaData';

interface ScaleCenterControlProps {
  onCenterClick?: () => void;
}

/**
 * Combined Scale and Center Control placed in the bottom-left corner of AtlasMap.
 * Features a quick "Center Nigeria" action and an accurate metric map scale bar.
 */
export const ScaleCenterControl: React.FC<ScaleCenterControlProps> = ({ onCenterClick }) => {
  const map = useMap();
  const [scale, setScale] = useState<{ width: number; label: string }>({ width: 60, label: '100 km' });

  // Calculate real ground distance scale based on latitude and current zoom
  const updateScale = useCallback(() => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const latRad = (center.lat * Math.PI) / 180;
    // Standard Web Mercator ground resolution: meters per pixel
    const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);

    // Target a comfortable bar width between 50px and 90px
    const targetMeters = metersPerPixel * 70;
    const standardDistances = [
      1000000, 500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000,
      500, 200, 100, 50, 20, 10, 5,
    ];
    let chosen = standardDistances[standardDistances.length - 1];
    for (const d of standardDistances) {
      if (targetMeters >= d * 0.7) {
        chosen = d;
        break;
      }
    }
    const width = Math.round(chosen / metersPerPixel);
    const label = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
    setScale({ width: Math.max(30, Math.min(width, 120)), label });
  }, [map]);

  useMapEvents({
    zoomend: updateScale,
    moveend: updateScale,
  });

  useEffect(() => {
    updateScale();
  }, [updateScale]);

  const handleCenter = () => {
    map.flyTo(NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
    if (onCenterClick) onCenterClick();
  };

  return (
    <div className="absolute bottom-3 left-3 z-[1000] pointer-events-auto select-none flex items-center gap-2.5 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151] shadow-xs text-xs font-sans transition-colors">
      {/* Center Nigeria Control Button */}
      <button
        onClick={handleCenter}
        className="flex items-center gap-1.5 text-[#374151] dark:text-[#D1D5DB] hover:text-[#0F7B4D] dark:hover:text-[#10B981] active:text-[#0F7B4D] transition-colors cursor-pointer group"
        title="Re-center to Nigeria nationwide view"
        aria-label="Center map on Nigeria"
      >
        <Crosshair className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF] group-hover:text-[#0F7B4D] dark:group-hover:text-[#10B981] transition-colors" />
        <span className="font-semibold text-[11px] tracking-tight">Center</span>
      </button>

      {/* Subtle Vertical Divider */}
      <div className="h-3.5 w-px bg-[#E5E7EB] dark:bg-[#374151]" />

      {/* Minimal Notched Scale Bar */}
      <div className="flex flex-col items-start font-mono">
        <span className="text-[10px] text-[#4B5563] dark:text-[#9CA3AF] font-bold leading-none mb-1 tabular-nums">
          {scale.label}
        </span>
        <div
          style={{ width: `${scale.width}px` }}
          className="h-1 border-b-[1.5px] border-l-[1.5px] border-r-[1.5px] border-[#111827] dark:border-[#F3F4F6] transition-colors"
        />
      </div>
    </div>
  );
};
