import React, { useState } from 'react';
import { MapViewMode } from '../../types/postcode';
import {
  Compass,
  Sparkles,
  Target,
  Info,
  ChevronRight,
  Wrench,
  GitCommitHorizontal,
  Menu,
  MessageSquare,
  X,
} from 'lucide-react';
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
  onToggleAskAtlas: () => void;
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
  onToggleAskAtlas,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileBreadcrumbsOpen, setMobileBreadcrumbsOpen] = useState(false);

  // Mobile action items
  const mobileActions = [
    { icon: Compass, label: 'States', onClick: onOpenStatesDrawer, title: 'Browse 37 States' },
    { icon: Wrench, label: 'Assemble', onClick: onOpenAssemblyDrawer, title: 'NIPOST Assembly Engine' },
    { icon: Sparkles, label: 'Surprise me', onClick: onRandomPlace, title: 'Explore a random location', color: '#0F7B4D' },
    { icon: Target, label: 'Hunt', onClick: onOpenHunt, title: 'Postcode Hunt challenge' },
    { icon: Info, label: 'About', onClick: onOpenStory, title: 'NIPOST NDAPS Documentation', color: undefined },
  ];

  const closeMobile = () => {
    setMobileMenuOpen(false);
    setMobileBreadcrumbsOpen(false);
  };

  return (
    <>
      {/* Main Top Bar */}
      <header className="h-12 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#374151] px-3 flex items-center justify-between select-none z-30 shrink-0 font-sans transition-colors">
        {/* Zone 1: Logo + compact breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onResetBreadcrumbs();
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <img
              src="/logo-header.svg"
              alt="Postcode Atlas"
              className="h-7 w-auto max-w-[160px] dark:hidden select-none pointer-events-none"
            />
            <img
              src="/logo-header-dark.svg"
              alt="Postcode Atlas"
              className="h-7 w-auto max-w-[160px] hidden dark:block select-none pointer-events-none"
            />
          </a>

          {/* Mobile breadcrumbs - collapsible */}
          <div className="hidden md:flex items-center text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono pl-2 border-l border-[#E5E7EB] dark:border-[#374151] min-w-0 overflow-hidden">
            <button
              onClick={onResetBreadcrumbs}
              className="hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              Nigeria
            </button>

            {breadcrumbs.state && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1 flex-shrink-0" />
                <button
                  onClick={onSelectStateBreadcrumb}
                  className="hover:text-[#111827] dark:hover:text-white transition-colors font-medium text-[#111827] dark:text-white cursor-pointer whitespace-nowrap flex-shrink-0 truncate max-w-[120px]"
                >
                  {breadcrumbs.state.name}
                </button>
              </>
            )}

            {breadcrumbs.lga && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1 flex-shrink-0" />
                <span className="text-[#374151] dark:text-[#D1D5DB] whitespace-nowrap flex-shrink-0 truncate max-w-[100px]">
                  {breadcrumbs.lga.name}
                </span>
              </>
            )}

            {breadcrumbs.district && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1 flex-shrink-0" />
                <span className="text-[#4B5563] dark:text-[#9CA3AF] whitespace-nowrap flex-shrink-0 truncate max-w-[80px]">
                  {breadcrumbs.district}
                </span>
              </>
            )}

            {breadcrumbs.area && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF] mx-1 flex-shrink-0" />
                <span className="text-[#0F7B4D] dark:text-[#10B981] font-semibold whitespace-nowrap flex-shrink-0 truncate max-w-[80px]">
                  {breadcrumbs.area}
                </span>
              </>
            )}
          </div>

          {/* Mobile breadcrumb toggle */}
          <button
            className="md:hidden p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded transition-colors"
            onClick={() => setMobileBreadcrumbsOpen(!mobileBreadcrumbsOpen)}
            aria-label={mobileBreadcrumbsOpen ? 'Hide location' : 'Show location'}
            aria-expanded={mobileBreadcrumbsOpen}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${mobileBreadcrumbsOpen ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Zone 2: Mode control */}
        <div className="flex items-center gap-0.5 bg-[#F3F4F6] dark:bg-[#1F2937] p-0.5 rounded-md border border-[#E5E7EB] dark:border-[#374151] mx-2">
          {(['map', 'data', 'density'] as MapViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                currentMode === mode
                  ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Zone 3: Right side - menu, version, theme */}
        <div className="flex items-center gap-1">
          {/* Ask Atlas conversational entry point */}
          <button
            onClick={onToggleAskAtlas}
            title="Ask Atlas in natural language"
            aria-label="Open Ask Atlas"
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#0F7B4D] dark:text-[#10B981] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Ask Atlas</span>
          </button>

          {/* Mobile hamburger menu - always rendered, shown on mobile via CSS */}
          <button
            className="mobile-hamburger p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Version badge - visible on all screens */}
          <button
            onClick={onOpenChangelog}
            title={`Version ${APP_VERSION} — release notes`}
            aria-label={`Version ${APP_VERSION}. Open release notes.`}
            className="mobile-version-badge hidden md:flex items-center gap-1 px-1.5 py-1 text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors cursor-pointer"
          >
            <GitCommitHorizontal className="w-3 h-3" />
            <span>v{APP_VERSION}</span>
          </button>

          {/* Theme Mode Selector - visible on all screens */}
          <div className="ml-1 pl-1 border-l border-[#E5E7EB] dark:border-[#374151] mobile-theme-toggle hidden sm:flex">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile breadcrumb drawer */}
      {mobileBreadcrumbsOpen && (
        <div className="md:hidden absolute top-12 left-3 right-3 z-40 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] rounded-lg shadow-lg p-3 animate-slide-down">
          <div className="flex items-center gap-2 text-xs font-mono text-[#6B7280] dark:text-[#9CA3AF]">
            <button
              onClick={onResetBreadcrumbs}
              className="hover:text-[#111827] dark:hover:text-white transition-colors"
            >
              Nigeria
            </button>
            {breadcrumbs.state && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
                <button
                  onClick={onSelectStateBreadcrumb}
                  className="hover:text-[#111827] dark:hover:text-white transition-colors font-medium text-[#111827] dark:text-white"
                >
                  {breadcrumbs.state.name}
                </button>
              </>
            )}
            {breadcrumbs.lga && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
                <span>{breadcrumbs.lga.name}</span>
              </>
            )}
            {breadcrumbs.district && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[#4B5563] dark:text-[#9CA3AF]">{breadcrumbs.district}</span>
              </>
            )}
            {breadcrumbs.area && (
              <>
                <ChevronRight className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[#0F7B4D] dark:text-[#10B981] font-semibold">{breadcrumbs.area}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile action menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#111827] border-t border-[#E5E7EB] dark:border-[#374151] rounded-t-2xl shadow-xl p-4 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111827] dark:text-white">Actions</h3>
              <button
                onClick={closeMobile}
                className="p-1 text-[#6B7280] hover:text-[#111827] dark:hover:text-white rounded"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {mobileActions.map((action, i) => (
                <button
                  key={action.label}
                  onClick={() => {
                    action.onClick();
                    closeMobile();
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 bg-[#F3F4F6] dark:bg-[#1F2937] rounded-xl border border-[#E5E7EB] dark:border-[#374151] transition-colors active:scale-[0.98] min-h-[80px]"
                  style={{ minHeight: '80px' }}
                >
                  <action.icon
                    className="w-6 h-6"
                    style={{ color: action.color ?? '#6B7280' }}
                  />
                  <span className="text-xs font-medium text-[#374151] dark:text-[#D1D5DB] text-center">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Version badge in mobile menu */}
            <div className="mt-4 pt-4 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center justify-center gap-1 px-1.5 py-1 text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF]">
              <GitCommitHorizontal className="w-3 h-3" />
              <span>v{APP_VERSION}</span>
              <button
                onClick={() => {
                  onOpenChangelog();
                  closeMobile();
                }}
                className="ml-2 text-xs underline hover:text-[#111827] dark:hover:text-white"
              >
                Release notes
              </button>
            </div>

            {/* Theme toggle in mobile menu */}
            <div className="mt-3 flex items-center justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      </>
  );
};