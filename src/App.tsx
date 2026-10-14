/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar } from './components/navigation/TopBar';
import { AtlasMap } from './components/map/AtlasMap';
import { MapSearch } from './components/search/MapSearch';
import { PostcodeInspector } from './components/postcode/PostcodeInspector';
import { StateExplorerDrawer } from './components/explorer/StateExplorerDrawer';
import { SavedDiscoveriesDrawer } from './components/saved/SavedDiscoveriesDrawer';
import { PostcodeAssemblyDrawer } from './components/assembly/PostcodeAssemblyDrawer';
import { DataModeOverlay } from './components/data/DataModeOverlay';
import { PostcodeHuntModal } from './components/hunt/PostcodeHuntModal';
import { DatasetStoryModal } from './components/story/DatasetStoryModal';
import { ChangelogModal } from './components/story/ChangelogModal';
import { UpdateBanner } from './components/ui/UpdateBanner';
import {
  applyUpdate,
  clearPendingUpdate,
  persistPendingUpdate,
  watchForUpdates,
} from './lib/version';
import { ToastProvider, useToast } from './hooks/useToast';
import { ThemeProvider } from './hooks/useTheme';
import { useSavedDiscoveries } from './hooks/useSavedDiscoveries';
import { postcodeSavedId, savedFromLocation, savedFromMessage } from './lib/saved/drafts';
import { discoveryShareUrl, shareOrCopy } from './lib/share/shareLink';
import type { SavedDiscovery } from './lib/saved/types';
import { ToastContainer } from './components/ui/Toast';
import { DraggableCard } from './components/ui/DraggableCard';
import { AskAtlasPanel } from './components/ask/AskAtlasPanel';
import { createApiResponder, createStubResponder } from './lib/ask/responder';
import { AskAtlasMessage, AtlasContextSnapshot } from './lib/ask/types';
import type { MapAction } from './lib/tools/types';
import {
  MapViewMode,
  PostcodeLocation,
  StateGeoInfo,
  NamedCode,
  SearchResultItem,
} from './types/postcode';
import { NIGERIA_CENTER, NIGERIA_DEFAULT_ZOOM, NIGERIA_STATES } from './lib/geo/nigeriaData';
import { postcodeApi } from './lib/api/postcodeClient';
import { atlasStore } from './lib/atlas/store';

function PostcodeAtlasContent() {
  const [currentMode, setCurrentMode] = useState<MapViewMode>('map');
  const [selectedLocation, setSelectedLocation] = useState<PostcodeLocation | null>(null);

  // Map viewport camera control
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [flyToZoom, setFlyToZoom] = useState<number | null>(null);

  // Hierarchical breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState<{
    state?: { code: string; name: string };
    lga?: { code: string; name: string };
    district?: string;
    area?: string;
  }>({});

  // Modals & Drawers
  const [isStatesDrawerOpen, setIsStatesDrawerOpen] = useState(false);
  const [isAssemblyDrawerOpen, setIsAssemblyDrawerOpen] = useState(false);
  const [isHuntModalOpen, setIsHuntModalOpen] = useState(false);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isAskAtlasOpen, setIsAskAtlasOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);

  // Real server-backed responder by default; VITE_ASK_MODE=stub keeps the
  // quota-free canned path for offline/UI work.
  const askResponderRef = useRef(
    import.meta.env.VITE_ASK_MODE === 'stub' ? createStubResponder() : createApiResponder(),
  );

  // The map viewport: the Ask Atlas card is clamped to it while dragging, so the
  // card can never be pulled off screen.
  const mainRef = useRef<HTMLElement>(null);

  // Version / update state
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [isJustUpdated, setIsJustUpdated] = useState(() => Boolean(window.__ATLAS_UPDATE_READY__));

  // Confirm the reload we just performed actually brought a newer build.
  useEffect(() => {
    if (!window.__ATLAS_UPDATE_READY__) return;
    const timeout = window.setTimeout(() => {
      setIsJustUpdated(false);
      window.__ATLAS_UPDATE_READY__ = false;
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, []);

  // Poll for newer deploys.
  useEffect(() => {
    // If we just reloaded into a newer bundle, drop any stale notice.
    if (window.__ATLAS_UPDATE_READY__) clearPendingUpdate();
    return watchForUpdates((latest) => {
      persistPendingUpdate(latest);
      setAvailableVersion(latest);
    });
  }, []);

  // Hydrate the local Atlas dataset once per release so grounded lookups
  // run locally with zero provider calls and keep working offline.
  useEffect(() => {
    void atlasStore.ensureHydrated();
  }, []);

  // Postcode Hunt state
  const [huntTarget, setHuntTarget] = useState<string | null>(null);
  const [huntHint, setHuntHint] = useState<string | null>(null);
  const [hasFoundHunt, setHasFoundHunt] = useState(false);
  const [huntScore, setHuntScore] = useState(0);
  const [huntAttempts, setHuntAttempts] = useState(0);

  // Map stats for Data mode
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [mapCenter, setMapCenter] = useState<[number, number]>(NIGERIA_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(NIGERIA_DEFAULT_ZOOM);
  const [isLocating, setIsLocating] = useState(false);

  const { showToast } = useToast();
  const {
    saved: savedDiscoveries,
    isSaved: isDiscoverySaved,
    toggle: toggleSavedDiscovery,
    remove: removeSavedDiscovery,
    clear: clearSavedDiscoveries,
  } = useSavedDiscoveries();

  // Handle URL deep link on mount (e.g. ?code=LA-11-A12-AK-08 or ?state=LA)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const stateParam = params.get('state');

    if (codeParam) {
      postcodeApi.lookupPostcode(codeParam).then((loc) => {
        if (loc) {
          setSelectedLocation(loc);
          if (loc.lat != null && loc.lng != null) {
            setFlyToCoords([loc.lat, loc.lng]);
            setFlyToZoom(17);
          }
          const s = NIGERIA_STATES[loc.state];
          if (s) {
            setBreadcrumbs({
              state: { code: s.code, name: s.name },
              lga: loc.lga ? { code: loc.lga, name: loc.lgaName || loc.lga } : undefined,
              district: loc.district,
              area: loc.area,
            });
          }
          showToast({
            title: 'Postcode Resolved',
            description: loc.postcode,
            type: 'info',
          });
        }
      });
    } else if (stateParam && NIGERIA_STATES[stateParam.toUpperCase()]) {
      const s = NIGERIA_STATES[stateParam.toUpperCase()];
      setFlyToCoords(s.center);
      setFlyToZoom(s.zoom);
      setBreadcrumbs({ state: { code: s.code, name: s.name } });
    }
  }, [showToast]);

  const getAskAtlasContext = useCallback(
    (): AtlasContextSnapshot => ({
      selectedState: breadcrumbs.state,
      selectedLga: breadcrumbs.lga,
      selectedDistrict: breadcrumbs.district,
      selectedArea: breadcrumbs.area,
      selectedPostcode: selectedLocation?.postcode,
      mapCenter,
      mapZoom,
    }),
    [breadcrumbs, selectedLocation, mapCenter, mapZoom],
  );

  const updateUrlLocation = useCallback((code?: string) => {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('code', code);
    } else {
      url.searchParams.delete('code');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Location selection handler
  const handleSelectLocation = async (loc: PostcodeLocation) => {
    if (huntTarget) {
      setHuntAttempts((prev) => prev + 1);
      if (loc.postcode === huntTarget) {
        setHasFoundHunt(true);
        setHuntScore(100);
        setIsHuntModalOpen(true);
        showToast({
          title: 'Objective Discovered!',
          description: `Target ${loc.postcode} confirmed (+100)`,
          type: 'success',
        });
      }
    }

    const enriched = await postcodeApi.lookupPostcode(loc.postcode);
    const finalLoc = enriched
      ? {
          ...loc,
          ...enriched,
          lat: loc.lat ?? enriched.lat,
          lng: loc.lng ?? enriched.lng,
        }
      : loc;

    setSelectedLocation(finalLoc);
    updateUrlLocation(finalLoc.postcode);

    if (finalLoc.lat != null && finalLoc.lng != null) {
      setFlyToCoords([finalLoc.lat, finalLoc.lng]);
      setFlyToZoom(17);
    }

    const stateInfo = NIGERIA_STATES[finalLoc.state];
    setBreadcrumbs({
      state: stateInfo ? { code: stateInfo.code, name: stateInfo.name } : undefined,
      lga: finalLoc.lga ? { code: finalLoc.lga, name: finalLoc.lgaName || finalLoc.lga } : undefined,
      district: finalLoc.district,
      area: finalLoc.area,
    });
  };

  // Save or remove a discovery from the saved list (feature 20).
  const handleToggleSaved = (draft: SavedDiscovery) => {
    const nowSaved = toggleSavedDiscovery(draft);
    showToast({
      title: nowSaved ? 'Saved to discoveries' : 'Removed from discoveries',
      description: draft.label,
      type: nowSaved ? 'success' : 'info',
    });
  };

  // The selected postcode as a saved draft, when it has a postcode.
  const handleToggleSaveLocation = (loc: PostcodeLocation) => {
    const draft = savedFromLocation(loc);
    if (draft) handleToggleSaved(draft);
  };

  // Whether an Ask Atlas reply's savable finding is already saved.
  const handleIsMessageSaved = (message: AskAtlasMessage) => {
    const draft = savedFromMessage(message);
    return draft ? isDiscoverySaved(draft.id) : false;
  };

  // State selection handler
  const handleSelectState = (state: StateGeoInfo) => {
    setSelectedLocation(null);
    updateUrlLocation(undefined);
    setBreadcrumbs({
      state: { code: state.code, name: state.name },
    });
    setFlyToCoords(state.center);
    setFlyToZoom(state.zoom);
    showToast({
      title: `${state.name} State`,
      description: `${state.lgaCount} LGAs · ${state.zone}`,
      type: 'info',
    });
  };

  // LGA selection handler
  const handleSelectLGA = (state: StateGeoInfo, lga: NamedCode) => {
    setSelectedLocation(null);
    setBreadcrumbs({
      state: { code: state.code, name: state.name },
      lga: { code: lga.code, name: lga.name || lga.code },
    });
    setFlyToCoords(state.center);
    setFlyToZoom(12);
    setIsStatesDrawerOpen(false);
    showToast({
      title: `${lga.name || lga.code} LGA`,
      description: `${state.name} State (${state.code}-${lga.code})`,
      type: 'info',
    });
  };

  // Reopen a saved discovery on the map (feature 20).
  const handleOpenSavedItem = (item: SavedDiscovery) => {
    if (item.kind === 'postcode' && item.postcode) {
      handleSelectLocation({
        postcode: item.postcode,
        state: item.stateCode || '',
        stateName: item.stateName,
        lga: item.lgaCode,
        lgaName: item.lgaName,
        lat: item.lat,
        lng: item.lng,
        address: item.label,
        category: item.category,
      });
    } else if (item.stateCode) {
      const stateInfo = NIGERIA_STATES[item.stateCode.toUpperCase()];
      if (stateInfo) {
        if (item.lgaCode) {
          handleSelectLGA(stateInfo, { code: item.lgaCode, name: item.lgaName || item.lgaCode });
        } else {
          handleSelectState(stateInfo);
        }
      }
    } else if (item.lat != null && item.lng != null) {
      setFlyToCoords([item.lat, item.lng]);
      setFlyToZoom(16);
    }
    setIsSavedDrawerOpen(false);
  };

  // Share a saved discovery through its deep link (feature 20).
  const handleShareSavedItem = async (item: SavedDiscovery) => {
    const url = discoveryShareUrl(item);
    if (!url) return;
    const result = await shareOrCopy({
      title: `Postcode Atlas · ${item.label}`,
      text: item.postcode
        ? `Nigeria Digital Postcode: ${item.postcode}`
        : `${item.label} on the Postcode Atlas`,
      url,
    });
    if (result === 'cancelled') return;
    showToast(
      result === 'failed'
        ? {
            title: 'Could not share',
            description: 'Copy the link manually from the address bar',
            type: 'error',
          }
        : result === 'shared'
        ? { title: 'Shared', description: item.label, type: 'info' }
        : { title: 'Share Link Copied', description: item.label, type: 'success' },
    );
  };

  // Reset to Nigeria national view
  const handleResetBreadcrumbs = () => {
    setBreadcrumbs({});
    setSelectedLocation(null);
    updateUrlLocation(undefined);
    setFlyToCoords(NIGERIA_CENTER);
    setFlyToZoom(NIGERIA_DEFAULT_ZOOM);
    showToast({ title: 'View Reset', description: 'National Overview', type: 'info' });
  };

  // Feature 8: move the map to the coordinates on an Ask Atlas reply.
  const handleViewLocation = useCallback(
    ({ lat, lng, label }: { lat: number; lng: number; label: string }) => {
      setFlyToCoords([lat, lng]);
      setFlyToZoom(17);
      showToast({ title: 'Map moved', description: label, type: 'info' });
    },
    [showToast],
  );

  // Feature 8: apply a validated navigateMap action. Every branch reuses the
  // same handlers the sidebar and search use, so a spoken request and a click
  // leave identical state.
  const handleMapAction = useCallback(
    (action: MapAction) => {
      if (action.target === 'postcode') {
        handleSelectLocation(action.location);
        return;
      }
      if (action.target === 'reset') {
        handleResetBreadcrumbs();
        return;
      }
      const stateInfo = NIGERIA_STATES[action.state.code.toUpperCase()];
      if (!stateInfo) return;
      if (action.target === 'state') {
        handleSelectState(stateInfo);
        return;
      }
      handleSelectLGA(stateInfo, { code: action.lga.code, name: action.lga.name });
    },
    [handleSelectLocation, handleSelectState, handleSelectLGA, handleResetBreadcrumbs],
  );

  // "Surprise me" random discovery
  const handleRandomPlace = async () => {
    const randomLoc = await postcodeApi.getRandomDiscoveryPoint();
    if (randomLoc) {
      handleSelectLocation(randomLoc);
      showToast({
        title: 'Exploration Pinpoint',
        description: randomLoc.address || randomLoc.postcode,
        type: 'info',
      });
    }
  };

  // Search result selected
  const handleSelectSearchResult = (result: SearchResultItem) => {
    if (result.type === 'state') {
      const s = NIGERIA_STATES[result.code || ''];
      if (s) handleSelectState(s);
    } else if (result.type === 'postcode') {
      if (result.location) {
        handleSelectLocation(result.location);
      } else if (result.code) {
        postcodeApi.lookupPostcode(result.code).then((loc) => {
          if (loc) {
            handleSelectLocation({
              ...loc,
              lat: result.coordinates[0],
              lng: result.coordinates[1],
            });
          }
        });
      }
    }
  };

  // Locate user GPS position
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      showToast({ title: 'Geolocation unavailable', type: 'error' });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFlyToCoords([latitude, longitude]);
        setFlyToZoom(16);

        try {
          const rev = await postcodeApi.reverseGeocode(latitude, longitude);
          if (rev && rev.postcode) {
            const loc: PostcodeLocation = {
              postcode: rev.postcode,
              state: rev.state || '',
              stateName: rev.stateName,
              lgaName: rev.lgaName,
              district: rev.district,
              area: rev.area,
              lat: latitude,
              lng: longitude,
              address: rev.address,
              distance_m: rev.distance_m,
            };
            setSelectedLocation(loc);
            showToast({
              title: 'Position Snapped',
              description: `NDAPS: ${rev.postcode}`,
              type: 'success',
            });
          } else {
            showToast({
              title: 'Location Acquired',
              description: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
              type: 'info',
            });
          }
        } catch (err) {
          console.warn('Geolocation reverse failed:', err);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        showToast({ title: 'Location permission denied', type: 'error' });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Postcode Hunt start
  const handleStartHunt = (targetCode: string, hint: string) => {
    setHuntTarget(targetCode);
    setHuntHint(hint);
    setHasFoundHunt(false);
    setHuntAttempts(0);
    setHuntScore(0);
    showToast({
      title: 'Postcode Hunt Active',
      description: `Target: ${targetCode}`,
      type: 'info',
    });
  };

  return (
    <div className="flex flex-col w-screen app-viewport overflow-hidden bg-[#FAFAF9] dark:bg-[#0B0F17] select-none font-sans relative">
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Top Bar Navigation */}
      <TopBar
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          showToast({
            title: `Mode: ${mode.toUpperCase()}`,
            description:
              mode === 'density'
                ? 'Visualizing digital address spatial distribution'
                : mode === 'data'
                ? 'Geospatial telemetry HUD active'
                : 'Cartographic map view',
            type: 'info',
          });
        }}
        breadcrumbs={breadcrumbs}
        onResetBreadcrumbs={handleResetBreadcrumbs}
        onSelectStateBreadcrumb={() => {
          if (breadcrumbs.state) {
            const s = NIGERIA_STATES[breadcrumbs.state.code];
            if (s) handleSelectState(s);
          }
        }}
        onOpenStatesDrawer={() => setIsStatesDrawerOpen(true)}
        onOpenAssemblyDrawer={() => setIsAssemblyDrawerOpen(true)}
        onRandomPlace={handleRandomPlace}
        onOpenHunt={() => setIsHuntModalOpen(true)}
        onOpenStory={() => setIsStoryModalOpen(true)}
        onOpenChangelog={() => setIsChangelogOpen(true)}
        onOpenSaved={() => setIsSavedDrawerOpen(true)}
        savedCount={savedDiscoveries.length}
        onToggleAskAtlas={() => setIsAskAtlasOpen((v) => !v)}
      />

      {/* Main Map Viewport (Occupies 95%+ of screen) */}
      <main ref={mainRef} className="relative flex-1 w-full h-full overflow-hidden">
        {/* Floating Arc / Linear Command Search */}
        <div className="absolute top-4 left-4 z-30 pointer-events-auto safe-left">
          <MapSearch
            onSelectResult={handleSelectSearchResult}
            onLocateUser={handleLocateUser}
            isLocating={isLocating}
          />
        </div>

        {/* Postcode Hunt Active Draggable Objective Bar */}
        {huntTarget && !hasFoundHunt && (
          <div className="absolute top-4 right-16 sm:right-20 z-30 pointer-events-auto safe-right">
            <DraggableCard dragHandleText="Hunt Target" dragConstraintsRef={mainRef}>
              <div className="bg-[#111827]/95 text-white backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#374151] shadow-md flex items-center gap-2.5 touch-spaced touch-edge-room text-xs">
                <div>
                  <span className="text-[9px] uppercase font-mono text-[#10B981] block tracking-wider font-bold">
                    Objective
                  </span>
                  <span className="font-mono font-medium">{huntTarget}</span>
                  <span className="text-[#9CA3AF] text-[11px] ml-1.5 font-sans">({huntHint})</span>
                </div>
                <button
                  onClick={() => setIsHuntModalOpen(true)}
                  className="touch-target text-[#D1D5DB] hover:text-white underline text-[11px] cursor-pointer"
                >
                  Details
                </button>
                <button
                  onClick={() => setHuntTarget(null)}
                  className="touch-target text-[#9CA3AF] hover:text-white text-xs ml-1 cursor-pointer"
                  aria-label="Cancel hunt"
                >
                  ✕
                </button>
              </div>
            </DraggableCard>
          </div>
        )}

        {/* The Cartographic Map Canvas */}
        <AtlasMap
          currentMode={currentMode}
          selectedLocation={selectedLocation}
          activeStateCode={breadcrumbs.state?.code || null}
          flyToCoords={flyToCoords}
          flyToZoom={flyToZoom}
          onSelectLocation={handleSelectLocation}
          onSelectState={handleSelectState}
          onMapStatsUpdate={(count, center, zoom) => {
            setVisibleCount(count);
            setMapCenter(center);
            setMapZoom(zoom);
          }}
        />

        {/* Mapbox/Linear Draggable Location Inspector Panel */}
        {selectedLocation && (
          <div className="absolute bottom-6 left-4 sm:left-6 z-30 pointer-events-auto safe-bottom safe-left">
            <DraggableCard dragHandleText="Postcode Inspector" dragConstraintsRef={mainRef}>
              <PostcodeInspector
                location={selectedLocation}
                isSaved={isDiscoverySaved(postcodeSavedId(selectedLocation.postcode))}
                onToggleSave={handleToggleSaveLocation}
                onClose={() => {
                  setSelectedLocation(null);
                  updateUrlLocation(undefined);
                }}
                onFlyTo={(coords) => {
                  setFlyToCoords(coords);
                  setFlyToZoom(17);
                }}
              />
            </DraggableCard>
          </div>
        )}

        {/* Data Mode Draggable HUD (Top Right) */}
        {currentMode === 'data' && (
          <div className="absolute top-14 sm:top-16 right-4 z-30 pointer-events-auto safe-right">
            <DraggableCard dragHandleText="Drag Telemetry" dragConstraintsRef={mainRef}>
              <DataModeOverlay
                visibleCount={visibleCount}
                centerCoords={mapCenter}
                zoomLevel={mapZoom}
                selectedLocation={selectedLocation}
                activeStateName={breadcrumbs.state?.name}
                activeLgaName={breadcrumbs.lga?.name}
              />
            </DraggableCard>
          </div>
        )}
        {/* Ask Atlas Conversational Panel (Bottom Right) */}
        {isAskAtlasOpen && (
          // Transparent wrapper spanning the map area. Its definite height is
          // what lets the card's own cap measure the room below the shell
          // header rather than the whole viewport, and `items-end` keeps the
          // card at the wrapper's bottom edge. `pt-2` is the gap the grip keeps
          // (`PANEL_TOP_GAP` in `src/lib/ask/panelLayout.ts`); the safe-area
          // helpers add only padding, never a visible margin. The card takes the
          // pointer events; the empty area above it stays clickable for the map.
          <div className="absolute bottom-6 right-4 top-0 z-30 pointer-events-none flex items-end pt-2 safe-bottom safe-right">
            <AskAtlasPanel
              responder={askResponderRef.current}
              getContext={getAskAtlasContext}
              onClose={() => setIsAskAtlasOpen(false)}
              onMapAction={handleMapAction}
              onViewLocation={handleViewLocation}
              dragConstraintsRef={mainRef}
              isMessageSaved={handleIsMessageSaved}
              onToggleSaveDiscovery={handleToggleSaved}
            />
          </div>
        )}
      </main>

      {/* State Explorer Drawer */}
      <StateExplorerDrawer
        isOpen={isStatesDrawerOpen}
        onClose={() => setIsStatesDrawerOpen(false)}
        onSelectState={handleSelectState}
        onSelectLGA={handleSelectLGA}
      />

      {/* Saved Discoveries Drawer (feature 20) */}
      <SavedDiscoveriesDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        items={savedDiscoveries}
        onOpenItem={handleOpenSavedItem}
        onRemoveItem={removeSavedDiscovery}
        onClear={clearSavedDiscoveries}
        onShareItem={handleShareSavedItem}
      />

      {/* Postcode Assembly & Disassembly Engine Drawer */}
      <PostcodeAssemblyDrawer
        isOpen={isAssemblyDrawerOpen}
        onClose={() => setIsAssemblyDrawerOpen(false)}
        onFlyToState={(stateCode) => {
          const s = NIGERIA_STATES[stateCode];
          if (s) handleSelectState(s);
        }}
        onLookupCode={(code) => {
          postcodeApi.lookupPostcode(code).then((loc) => {
            if (loc) handleSelectLocation(loc);
          });
          setIsAssemblyDrawerOpen(false);
        }}
      />

      {/* Postcode Hunt Modal */}
      <PostcodeHuntModal
        isOpen={isHuntModalOpen}
        onClose={() => setIsHuntModalOpen(false)}
        onStartHunt={handleStartHunt}
        activeTarget={huntTarget}
        hasFound={hasFoundHunt}
        score={huntScore}
        attempts={huntAttempts}
        onSelectDiscoveryPoint={handleSelectLocation}
      />

      {/* Dataset Documentation Story Modal */}
      <DatasetStoryModal
        isOpen={isStoryModalOpen}
        onClose={() => setIsStoryModalOpen(false)}
      />

      {/* Release Notes */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />

      {/* New-version notice */}
      {availableVersion && (
        <UpdateBanner
          latestVersion={availableVersion}
          isJustUpdated={isJustUpdated}
          onApply={applyUpdate}
          onDismiss={() => {
            clearPendingUpdate();
            setAvailableVersion(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PostcodeAtlasContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
