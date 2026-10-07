import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  Popup,
  Circle,
  Tooltip,
} from 'react-leaflet';
import L from 'leaflet';
import { MapViewMode, PostcodeLocation, StateGeoInfo } from '../../types/postcode';
import { NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM, NIGERIA_STATES } from '../../lib/geo/nigeriaData';
import { postcodeApi } from '../../lib/api/postcodeClient';
import { CustomZoomControl } from './CustomZoomControl';
import { ScaleCenterControl } from './ScaleCenterControl';
import { useTheme } from '../../hooks/useTheme';

// Tile provider options (Abstracted and user-switchable, 100% free with no watermarks)
export type TileStyle = 'light' | 'voyager' | 'satellite';

const TILE_PROVIDERS: Record<TileStyle, { name: string; url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
  light: {
    name: 'Cartographic Base',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
  voyager: {
    name: 'Light Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; OpenStreetMap contributors',
    maxZoom: 16,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
};

const DARK_CANVAS_TILE: { name: string; url: string; attribution: string; maxZoom: number; subdomains?: string } = {
  name: 'Dark Canvas',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri &copy; OpenStreetMap contributors',
  maxZoom: 16,
};

// Create custom DOM / SVG marker icons with theme awareness
function createStateIcon(code: string, count: number, isSelected: boolean, isDark: boolean, isSatellite: boolean) {
  const bg = isSelected
    ? '#0F7B4D'
    : isDark
    ? '#1F2937'
    : isSatellite
    ? 'rgba(255,255,255,0.92)'
    : '#ffffff';
  const text = isSelected || isDark ? '#ffffff' : '#111827';
  const border = isSelected
    ? '#10B981'
    : isDark
    ? '#374151'
    : isSatellite
    ? '#ffffff'
    : '#E5E7EB';

  return L.divIcon({
    className: 'custom-state-marker',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        background: ${bg};
        color: ${text};
        border: 1.5px solid ${border};
        box-shadow: 0 4px 10px rgba(0, 0, 0, ${isDark || isSatellite ? '0.45' : '0.08'});
        font-family: 'Geist Mono', monospace;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      ">
        <span style="letter-spacing: -0.02em;">${code}</span>
        <span style="font-size: 8px; opacity: 0.75; font-weight: 400; margin-top: -2px;">${count}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createBuildingIcon(isSelected: boolean, isCommercial: boolean, isDark: boolean, isSatellite: boolean) {
  const bg = isSelected
    ? '#0F7B4D'
    : isCommercial
    ? '#0D9488'
    : isSatellite
    ? '#22c55e'
    : isDark
    ? '#38BDF8'
    : '#111827';
  const size = isSelected ? 24 : 16;

  return L.divIcon({
    className: 'custom-building-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
      ">
        ${
          isSelected
            ? `<div style="
                position: absolute;
                inset: -8px;
                border-radius: 9999px;
                background: rgba(15, 123, 77, 0.4);
                animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>`
            : ''
        }
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 9999px;
          background: ${bg};
          border: 2px solid ${isDark ? '#111827' : '#ffffff'};
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          cursor: pointer;
          transition: transform 0.15s ease;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface MapControllerProps {
  flyToCoords: [number, number] | null;
  flyToZoom: number | null;
  onViewChange: (center: [number, number], zoom: number) => void;
  onCursorMove: (coords: [number, number]) => void;
  onViewportBuildingsRequest: (lat: number, lng: number) => void;
}

const MapController: React.FC<MapControllerProps> = ({
  flyToCoords,
  flyToZoom,
  onViewChange,
  onCursorMove,
  onViewportBuildingsRequest,
}) => {
  const map = useMap();
  const lastCenterRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (flyToCoords) {
      map.flyTo(flyToCoords, flyToZoom || 16, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [flyToCoords, flyToZoom, map]);

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const coords: [number, number] = [center.lat, center.lng];
      onViewChange(coords, zoom);

      if (zoom >= 13) {
        const last = lastCenterRef.current;
        if (!last || Math.abs(last[0] - coords[0]) > 0.003 || Math.abs(last[1] - coords[1]) > 0.003) {
          lastCenterRef.current = coords;
          onViewportBuildingsRequest(coords[0], coords[1]);
        }
      }
    },
    zoomend: () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onViewChange([center.lat, center.lng], zoom);
    },
    mousemove: (e) => {
      onCursorMove([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
};

interface AtlasMapProps {
  currentMode: MapViewMode;
  selectedLocation: PostcodeLocation | null;
  activeStateCode: string | null;
  flyToCoords: [number, number] | null;
  flyToZoom: number | null;
  onSelectLocation: (loc: PostcodeLocation) => void;
  onSelectState: (state: StateGeoInfo) => void;
  onMapStatsUpdate: (visibleCount: number, center: [number, number], zoom: number) => void;
}

export const AtlasMap: React.FC<AtlasMapProps> = ({
  currentMode,
  selectedLocation,
  activeStateCode,
  flyToCoords,
  flyToZoom,
  onSelectLocation,
  onSelectState,
  onMapStatsUpdate,
}) => {
  const [currentZoom, setCurrentZoom] = useState<number>(NIGERIA_DEFAULT_ZOOM);
  const [buildingLocations, setBuildingLocations] = useState<PostcodeLocation[]>([]);
  const [tileStyle, setTileStyle] = useState<TileStyle>('light');
  const [cursorCoords, setCursorCoords] = useState<[number, number]>(NIGERIA_CENTER);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isDark } = useTheme();

  // Load verified discovery landmarks on mount
  useEffect(() => {
    let mounted = true;
    postcodeApi.getDiscoveryPoints().then((points) => {
      if (mounted && points.length > 0) {
        setBuildingLocations((prev) => {
          const map = new Map<string, PostcodeLocation>();
          [...points, ...prev].forEach((p) => map.set(p.postcode, p));
          return Array.from(map.values());
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Request nearby buildings dynamically when zoomed in
  const handleViewportBuildingsRequest = useCallback(async (lat: number, lng: number) => {
    try {
      const nearby = await postcodeApi.reverseGeocode(lat, lng);
      if (nearby && nearby.postcode) {
        const loc: PostcodeLocation = {
          postcode: nearby.postcode,
          state: nearby.state || '',
          stateName: nearby.stateName,
          lgaName: nearby.lgaName,
          district: nearby.district,
          area: nearby.area,
          lat,
          lng,
          address: nearby.address,
          distance_m: nearby.distance_m,
        };
        setBuildingLocations((prev) => {
          if (!prev.some((b) => b.postcode === loc.postcode)) {
            return [...prev, loc];
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Nearby request error:', err);
    }
  }, []);

  const handleViewChange = useCallback(
    (center: [number, number], zoom: number) => {
      setCurrentZoom(zoom);
      const visible = buildingLocations.filter((b) => {
        if (b.lat == null || b.lng == null) return false;
        const dLat = Math.abs(b.lat - center[0]);
        const dLng = Math.abs(b.lng - center[1]);
        return dLat < 0.8 && dLng < 0.8;
      });
      onMapStatsUpdate(visible.length, center, zoom);
    },
    [buildingLocations, onMapStatsUpdate]
  );

  const toggleTileStyle = () => {
    setTileStyle((prev) => (prev === 'light' ? 'voyager' : prev === 'voyager' ? 'satellite' : 'light'));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const statesList = Object.values(NIGERIA_STATES);

  useEffect(() => {
    if (selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null) {
      setBuildingLocations((prev) => {
        if (!prev.some((b) => b.postcode === selectedLocation.postcode)) {
          return [...prev, selectedLocation];
        }
        return prev;
      });
    }
  }, [selectedLocation]);

  // Determine active provider based on tileStyle and theme mode
  const activeProvider =
    tileStyle === 'satellite'
      ? TILE_PROVIDERS.satellite
      : isDark && tileStyle === 'light'
      ? DARK_CANVAS_TILE
      : TILE_PROVIDERS[tileStyle];

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#f8f8f7] dark:bg-[#0B0F17] overflow-hidden">
      <MapContainer
        center={NIGERIA_CENTER}
        zoom={NIGERIA_DEFAULT_ZOOM}
        minZoom={5}
        maxZoom={19}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-10"
      >
        <TileLayer
          key={`${tileStyle}-${isDark ? 'dark' : 'light'}`}
          url={activeProvider.url}
          attribution={activeProvider.attribution}
          subdomains={activeProvider.subdomains || 'abc'}
          maxZoom={activeProvider.maxZoom}
        />

        <MapController
          flyToCoords={flyToCoords}
          flyToZoom={flyToZoom}
          onViewChange={handleViewChange}
          onCursorMove={setCursorCoords}
          onViewportBuildingsRequest={handleViewportBuildingsRequest}
        />

        {/* Bottom-Left: Scale & Center Control Capsule */}
        <ScaleCenterControl
          onCenterClick={() => onMapStatsUpdate(0, NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM)}
        />

        {/* 1. Low Zoom: State aggregated markers (Zoom < 10) */}
        {currentZoom < 10 &&
          statesList.map((state) => {
            const isSelected = activeStateCode === state.code;
            return (
              <Marker
                key={state.code}
                position={state.center}
                icon={createStateIcon(state.code, state.lgaCount, isSelected, isDark, tileStyle === 'satellite')}
                eventHandlers={{
                  click: () => onSelectState(state),
                }}
              >
                <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                  <div className="font-sans text-xs">
                    <span className="font-semibold text-stone-900">{state.name} State</span>
                    <span className="text-[10px] text-stone-500 font-mono ml-1.5">({state.code})</span>
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

        {/* 2. High Zoom: Individual building-level digital postcode units (Zoom >= 10) */}
        {currentZoom >= 10 &&
          buildingLocations.map((loc) => {
            if (loc.lat == null || loc.lng == null) return null;
            const isSelected = selectedLocation?.postcode === loc.postcode;
            const isCommercial = loc.buildingUse === 'non-residential' || loc.buildingUse === 'commercial';

            return (
              <Marker
                key={loc.postcode}
                position={[loc.lat, loc.lng]}
                icon={createBuildingIcon(isSelected, isCommercial, isDark, tileStyle === 'satellite')}
                eventHandlers={{
                  click: () => onSelectLocation(loc),
                }}
              >
                <Popup className="custom-atlas-popup">
                  <div className="font-sans text-xs p-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono font-bold text-stone-900 tracking-wider">
                        {loc.postcode}
                      </div>
                      <span className="text-[9px] font-mono uppercase bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded">
                        NDAPS
                      </span>
                    </div>
                    {loc.address && (
                      <div className="text-[11px] text-stone-600 mt-1 font-medium">{loc.address}</div>
                    )}
                    <div className="text-[10px] text-stone-400 mt-0.5 capitalize">
                      {loc.buildingUse || 'Addressable structure'}
                    </div>
                    <button
                      onClick={() => onSelectLocation(loc)}
                      className="mt-2 w-full py-1 text-[11px] font-medium bg-[#111827] text-white rounded hover:bg-black transition-colors text-center cursor-pointer"
                    >
                      Inspect Postcode
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* 3. Density Mode: Spatial circles representing digital address density */}
        {currentMode === 'density' && (
          <>
            {statesList.map((s) => (
              <Circle
                key={`density-${s.code}`}
                center={s.center}
                radius={24000 + s.lgaCount * 1200}
                pathOptions={{
                  color: '#0F7B4D',
                  fillColor: '#10B981',
                  fillOpacity: tileStyle === 'satellite' ? 0.25 : 0.12,
                  weight: 1.5,
                  dashArray: '3, 4',
                }}
              />
            ))}
            {buildingLocations.map((b) => {
              if (b.lat == null || b.lng == null) return null;
              return (
                <Circle
                  key={`density-point-${b.postcode}`}
                  center={[b.lat, b.lng]}
                  radius={280}
                  pathOptions={{
                    color: '#0F7B4D',
                    fillColor: '#059669',
                    fillOpacity: 0.4,
                    weight: 1.5,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Bottom-Right Controls & Telemetry Stack (inside MapContainer for useMap context) */}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-[1000] pointer-events-none select-none">
          {/* Minimal Custom Zoom Controls */}
          <CustomZoomControl
            tileStyle={tileStyle}
            onToggleTileStyle={toggleTileStyle}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />

          {/* Live Cursor Coordinates & Basemap HUD */}
          <div className="bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#374151] text-[10px] font-mono text-[#4B5563] dark:text-[#9CA3AF] pointer-events-none flex items-center gap-2 shadow-xs transition-colors">
            <div className="flex items-center gap-1 text-[#0F7B4D] dark:text-[#10B981] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B4D] dark:bg-[#10B981]" />
              <span>
                {cursorCoords[0].toFixed(4)}° N, {cursorCoords[1].toFixed(4)}° E
              </span>
            </div>
            <span className="text-[#E5E7EB] dark:text-[#374151]">|</span>
            <span className="text-[#6B7280] dark:text-[#9CA3AF]">{activeProvider.name}</span>
            <span className="text-[#E5E7EB] dark:text-[#374151]">|</span>
            <span className="text-[#6B7280] dark:text-[#9CA3AF]">Z: {currentZoom.toFixed(1)}</span>
          </div>
        </div>
      </MapContainer>
    </div>
  );
};
