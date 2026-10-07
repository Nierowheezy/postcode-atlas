import React from 'react';
import { MapViewMode } from '../../types/postcode';
import { Compass, Sparkles, Target, Info, ChevronRight, Wrench, GitCommitHorizontal } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { APP_VERSION } from '../../lib/version';

interface TopBarProps {
  currentMode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
  onOpenChangelog: () => void;
  breadcrumbs: {
    state?: { code: string; name: string };
    lga?: { code: string; name: string };
    district?: string;
    area?: string;
  };
  onResetBreadcrumbs: () => void;
  onSelectStateBreadcrumb: () => void;
  onOpenStatesDrawer: () => void;
  onOpenAssemblyDrawer: () => void;
  onRandomPlace: () => void;
  onOpenHunt: () => void;
  onOpenStory: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentMode,
  onModeChange,
  onOpenChangelog,
  breadcrumbs,
  onResetBreadcrumbs,
  onSelectStateBreadcrumb,
  onOpenStatesDrawer,
  onOpenAssemblyDrawer,
  onRandomPlace,
  onOpenHunt,
  onOpenStory,
}) => {
  return (
    <header className="h-12 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#374151] px-4 flex items-center justify-between select-none z-30 shrink-0 font-sans transition-colors">
      {/* Zone 1: Single text wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onResetBreadcrumbs();
          }}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img
            src="/logo-header.svg"
            alt="Postcode Atlas"
            className="h-7 w-auto dark:hidden select-none pointer-events-none"
          />
          <img
            src="/logo-header-dark.svg"
            alt="Postcode Atlas"
            className="h-7 w-auto hidden dark:block select-none pointer-events-none"
          />
        </a>

        {/* Hierarchical breadcrumbs in Geist Mono */}
        <div className="hidden md:flex items-center text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono pl-3 border-l border-[#E5E7EB] dark:border-[#374151]">
          <button
            onClick={onResetBreadcrumbs}
            className="hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
          >
            Nigeria
          </button>

          {breadcrumbs.state && (
            <>
              <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1" />
              <button
                onClick={onSelectStateBreadcrumb}
                className="hover:text-[#111827] dark:hover:text-white transition-colors font-medium text-[#111827] dark:text-white cursor-pointer"
              >
                {breadcrumbs.state.name}
              </button>
            </>
          )}

          {breadcrumbs.lga && (
            <>
              <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1" />
              <span className="text-[#374151] dark:text-[#D1D5DB]">{breadcrumbs.lga.name}</span>
            </>
          )}

          {breadcrumbs.district && (
            <>
              <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1" />
              <span className="text-[#4B5563] dark:text-[#9CA3AF]">{breadcrumbs.district}</span>
            </>
          )}

          {breadcrumbs.area && (
            <>
              <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1" />
              <span className="text-[#0F7B4D] dark:text-[#10B981] font-semibold">{breadcrumbs.area}</span>
            </>
          )}
        </div>
      </div>

      {/* Zone 2: Segmented Mode control */}
      <div className="flex items-center gap-0.5 bg-[#F3F4F6] dark:bg-[#1F2937] p-0.5 rounded-md border border-[#E5E7EB] dark:border-[#374151]">
        <button
          onClick={() => onModeChange('map')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            currentMode === 'map'
              ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs'
              : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          Map
        </button>
        <button
          onClick={() => onModeChange('data')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            currentMode === 'data'
              ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs'
              : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          Data
        </button>
        <button
          onClick={() => onModeChange('density')}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
            currentMode === 'density'
              ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs'
              : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
          }`}
        >
          Density
        </button>
      </div>

      {/* Zone 3: Primary actions & Theme toggle */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          onClick={onOpenStatesDrawer}
          className="px-2.5 py-1.5 text-xs font-medium text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          title="Browse 37 States"
        >
          <Compass className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          <span className="hidden sm:inline">States</span>
        </button>

        <button
          onClick={onOpenAssemblyDrawer}
          className="px-2.5 py-1.5 text-xs font-medium text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          title="NIPOST Assembly Engine"
        >
          <Wrench className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          <span className="hidden lg:inline">Assemble</span>
        </button>

        <button
          onClick={onRandomPlace}
          className="px-2.5 py-1.5 text-xs font-medium text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          title="Explore a random location in Nigeria"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0F7B4D] dark:text-[#10B981]" />
          <span className="hidden sm:inline">Surprise me</span>
        </button>

        <button
          onClick={onOpenHunt}
          className="px-2.5 py-1.5 text-xs font-medium text-[#374151] dark:text-[#D1D5DB] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          title="Postcode Hunt challenge"
        >
          <Target className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
          <span className="hidden md:inline">Hunt</span>
        </button>

        <button
          onClick={onOpenStory}
          className="p-1.5 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors cursor-pointer"
          title="NIPOST NDAPS Documentation"
          aria-label="About the system"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* Version badge — click opens the in-app release notes */}
        <button
          onClick={onOpenChangelog}
          title={`Version ${APP_VERSION} — release notes`}
          aria-label={`Version ${APP_VERSION}. Open release notes.`}
          className="hidden sm:flex items-center gap-1 px-1.5 py-1 text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors cursor-pointer"
        >
          <GitCommitHorizontal className="w-3 h-3" />
          <span>v{APP_VERSION}</span>
        </button>

        {/* Theme Mode Selector (Light, Dark, System) */}
        <div className="ml-1 pl-1 border-l border-[#E5E7EB] dark:border-[#374151]">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
