import React from 'react';
import { PostcodeLocation } from '../../types/postcode';
import { Activity, Compass, MapPin } from 'lucide-react';

interface DataModeOverlayProps {
  visibleCount: number;
  centerCoords: [number, number];
  zoomLevel: number;
  selectedLocation: PostcodeLocation | null;
  activeStateName?: string;
  activeLgaName?: string;
}

export const DataModeOverlay: React.FC<DataModeOverlayProps> = ({
  visibleCount,
  centerCoords,
  zoomLevel,
  selectedLocation,
  activeStateName,
  activeLgaName,
}) => {
  return (
    <div className="w-72 sm:w-80 p-4 select-none text-zinc-900 dark:text-zinc-50 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="uppercase tracking-wider font-mono">Geospatial Telemetry</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          LIVE HUD
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 my-3">
        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          <div className="text-[11px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wider font-mono font-bold">
            Visible Units
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white tabular-nums mt-0.5">
            {visibleCount}
          </div>
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">Current Viewport</div>
        </div>

        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-2xs">
          <div className="text-[11px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wider font-mono font-bold">
            Zoom Scale
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {zoomLevel.toFixed(1)}z
          </div>
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
            {zoomLevel >= 14 ? 'Building Level' : zoomLevel >= 9 ? 'LGA Scale' : 'National Scale'}
          </div>
        </div>
      </div>

      {/* Geolocation crosshair */}
      <div className="py-2.5 border-t border-zinc-200 dark:border-zinc-700 text-xs">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-bold mb-1.5 flex items-center justify-between">
          <span>Map Center Position</span>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">WGS84</span>
        </div>
        <div className="font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-md text-xs flex justify-between font-bold border border-zinc-200/80 dark:border-zinc-700">
          <span>LAT: {centerCoords[0].toFixed(5)}° N</span>
          <span>LNG: {centerCoords[1].toFixed(5)}° E</span>
        </div>
      </div>

      {/* Regional context */}
      <div className="py-2.5 border-t border-zinc-200 dark:border-zinc-700 text-xs flex justify-between items-center">
        <span className="text-zinc-600 dark:text-zinc-300 font-semibold flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Jurisdiction</span>
        </span>
        <span className="font-bold text-zinc-900 dark:text-white font-mono truncate max-w-40 text-right">
          {activeStateName ? `${activeStateName}${activeLgaName ? ` / ${activeLgaName}` : ''}` : 'National Overview'}
        </span>
      </div>

      {/* Selected location focus */}
      {selectedLocation && (
        <div className="pt-2.5 border-t border-zinc-200 dark:border-zinc-700 text-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-300 font-bold mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Target Focus</span>
          </div>
          <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm tracking-wide">
            {selectedLocation.postcode}
          </div>
          {selectedLocation.address && (
            <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium truncate mt-1">
              {selectedLocation.address}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
