import React from 'react';
import { useMap } from 'react-leaflet';
import { Plus, Minus, Maximize2, Minimize2, Layers } from 'lucide-react';
import { TileStyle } from './AtlasMap';

interface CustomZoomControlProps {
  tileStyle: TileStyle;
  onToggleTileStyle: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Minimal, custom zoom control component placed in the bottom-right corner,
 * designed to match the application's restrained aesthetic and replace
 * default Leaflet buttons.
 */
export const CustomZoomControl: React.FC<CustomZoomControlProps> = ({
  tileStyle,
  onToggleTileStyle,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const map = useMap();

  return (
    <div className="flex flex-col bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md rounded-lg border border-[#E5E7EB] dark:border-[#374151] shadow-xs overflow-hidden select-none z-30 pointer-events-auto">
      {/* Zoom In */}
      <button
        onClick={() => map.zoomIn()}
        className="w-8 h-8 flex items-center justify-center text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] active:bg-[#F3F4F6] transition-colors cursor-pointer"
        title="Zoom in (+)"
        aria-label="Zoom in"
      >
        <Plus className="w-4 h-4 stroke-[1.75]" />
      </button>

      <div className="h-px w-full bg-[#E5E7EB] dark:bg-[#374151]" />

      {/* Zoom Out */}
      <button
        onClick={() => map.zoomOut()}
        className="w-8 h-8 flex items-center justify-center text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] active:bg-[#F3F4F6] transition-colors cursor-pointer"
        title="Zoom out (-)"
        aria-label="Zoom out"
      >
        <Minus className="w-4 h-4 stroke-[1.75]" />
      </button>

      <div className="h-px w-full bg-[#E5E7EB] dark:bg-[#374151]" />

      {/* Layer Switcher */}
      <button
        onClick={onToggleTileStyle}
        className={`w-8 h-8 flex items-center justify-center transition-colors cursor-pointer ${
          tileStyle === 'satellite'
            ? 'text-[#0F7B4D] dark:text-[#10B981] bg-[#F0FDF4] dark:bg-[#064E3B]'
            : 'text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937]'
        }`}
        title={`Map Style: ${tileStyle.toUpperCase()} (Toggle)`}
        aria-label="Toggle map style"
      >
        <Layers className="w-3.5 h-3.5 stroke-[1.75]" />
      </button>

      <div className="h-px w-full bg-[#E5E7EB] dark:bg-[#374151]" />

      {/* Fullscreen Toggle */}
      <button
        onClick={onToggleFullscreen}
        className="w-8 h-8 flex items-center justify-center text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] active:bg-[#F3F4F6] transition-colors cursor-pointer"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        aria-label="Toggle fullscreen"
      >
        {isFullscreen ? (
          <Minimize2 className="w-3.5 h-3.5 stroke-[1.75]" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 stroke-[1.75]" />
        )}
      </button>
    </div>
  );
};
