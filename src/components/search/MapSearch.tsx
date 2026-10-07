import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Navigation } from 'lucide-react';
import { SearchResultItem } from '../../types/postcode';
import { NIGERIA_STATES } from '../../lib/geo/nigeriaData';
import { postcodeApi } from '../../lib/api/postcodeClient';

interface MapSearchProps {
  onSelectResult: (result: SearchResultItem) => void;
  onLocateUser: () => void;
  isLocating?: boolean;
}

export const MapSearch: React.FC<MapSearchProps> = ({
  onSelectResult,
  onLocateUser,
  isLocating,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: Cmd+K or /
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search logic using official NIPOST API + local state registry
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const matches: SearchResultItem[] = [];
      const lower = q.toLowerCase();

      // 1. Search official Nigerian States
      Object.values(NIGERIA_STATES).forEach((s) => {
        if (s.name.toLowerCase().includes(lower) || s.code.toLowerCase() === lower) {
          matches.push({
            id: `state-${s.code}`,
            type: 'state',
            title: s.name,
            subtitle: `${s.capital} · ${s.zone}`,
            code: s.code,
            stateCode: s.code,
            coordinates: s.center,
            zoom: s.zoom,
          });
        }
      });

      // 2. Query official NIPOST Autocomplete endpoint (/v1/search/autocomplete)
      try {
        const auto = await postcodeApi.autocomplete(q);
        if (auto && auto.suggestions && auto.suggestions.length > 0) {
          auto.suggestions.forEach((sug, idx) => {
            const code = sug.code;
            const stateCode = code.substring(0, 2).toUpperCase();
            const stateInfo = NIGERIA_STATES[stateCode];

            matches.push({
              id: `nipost-auto-${code}-${idx}`,
              type: auto.segment === 'state' ? 'state' : 'postcode',
              title: code,
              subtitle: sug.label || (stateInfo ? `${stateInfo.name} State` : 'NIPOST NDAPS Registry'),
              code,
              stateCode,
              coordinates: stateInfo ? stateInfo.center : [9.082, 8.6753],
              zoom: auto.segment === 'unit' ? 17 : auto.segment === 'area' ? 14 : 11,
            });
          });
        }
      } catch {
        // Fallback continues
      }

      // 3. Search verified discovery points
      try {
        const discPoints = await postcodeApi.getDiscoveryPoints();
        discPoints.forEach((p) => {
          if (
            p.postcode.toLowerCase().includes(lower) ||
            p.address?.toLowerCase().includes(lower) ||
            p.lgaName?.toLowerCase().includes(lower) ||
            p.stateName?.toLowerCase().includes(lower)
          ) {
            if (!matches.some((m) => m.code === p.postcode)) {
              matches.push({
                id: `postcode-${p.postcode}`,
                type: 'postcode',
                title: p.postcode,
                subtitle: p.address || `${p.lgaName || ''}, ${p.stateName || ''}`,
                code: p.postcode,
                stateCode: p.state,
                lgaCode: p.lga,
                coordinates: [p.lat || 9.082, p.lng || 8.6753],
                zoom: 17,
                location: p,
              });
            }
          }
        });
      } catch {
        // Ignore fallback
      }

      // 4. Pattern match standard 11-char or partial postcodes (e.g. LA-11, EK-01)
      const postcodePattern = /^[A-Z]{2}[-\s]?[0-9]{2}/i;
      if (postcodePattern.test(q)) {
        const cleanCode = q.replace(/\s+/g, '-').toUpperCase();
        if (!matches.some((m) => m.code === cleanCode)) {
          const stateCode = cleanCode.substring(0, 2);
          const stateInfo = NIGERIA_STATES[stateCode];
          if (stateInfo) {
            matches.unshift({
              id: `pattern-${cleanCode}`,
              type: 'postcode',
              title: cleanCode,
              subtitle: `${stateInfo.name} State · Digital Address Lookup`,
              code: cleanCode,
              stateCode,
              coordinates: stateInfo.center,
              zoom: 15,
            });
          }
        }
      }

      setResults(matches.slice(0, 6));
      setSelectedIndex(0);
      setIsOpen(matches.length > 0);
      setIsLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[selectedIndex];
      if (selected) {
        onSelectResult(selected);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-72 sm:w-88 md:w-96 select-none">
      {/* Arc / Linear style command search box */}
      <div className="flex items-center bg-white dark:bg-[#111827]/95 backdrop-blur-md rounded-lg border border-[#E5E7EB] dark:border-[#374151] shadow-xs focus-within:border-[#0F7B4D] focus-within:ring-1 focus-within:ring-[#0F7B4D] transition-all px-3 py-2 text-xs">
        {/* Arc-style green dot affordance */}
        <span
          className="w-2 h-2 rounded-full mr-2.5 shrink-0 transition-transform duration-200 bg-[#0F7B4D]"
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search postcode, state, LGA or area..."
          className="w-full bg-transparent outline-none text-[#111827] dark:text-white placeholder:text-[#9CA3AF] font-sans text-xs tracking-normal"
        />

        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F7B4D] shrink-0 mx-1" />
        ) : query ? (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Clear input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#9CA3AF] bg-[#F3F4F6] dark:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151]">
            ⌘K
          </kbd>
        )}

        {/* Locate me quick action */}
        <div className="pl-1.5 ml-1.5 border-l border-[#E5E7EB] dark:border-[#374151] shrink-0">
          <button
            onClick={onLocateUser}
            disabled={isLocating}
            className={`p-1 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition-colors rounded cursor-pointer ${
              isLocating ? 'animate-pulse text-[#0F7B4D]' : ''
            }`}
            title="Locate my position (GPS)"
            aria-label="Find my location"
          >
            <Navigation className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Autocomplete suggestions dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#111827] rounded-lg border border-[#E5E7EB] dark:border-[#374151] shadow-lg overflow-hidden z-40">
          <div className="p-1 max-h-64 overflow-y-auto space-y-0.5">
            {results.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isPostcode = item.type === 'postcode';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectResult(item);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center justify-between text-xs cursor-pointer ${
                    isSelected
                      ? 'bg-[#F9FAFB] dark:bg-[#1F2937] text-[#111827] dark:text-white'
                      : 'text-[#374151] dark:text-[#D1D5DB] hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isPostcode ? 'bg-[#0F7B4D]' : 'bg-[#9CA3AF]'
                      }`}
                    />
                    <div className="truncate">
                      <div
                        className={`truncate text-xs ${
                          isPostcode ? 'font-mono font-medium tracking-tight text-[#111827] dark:text-white' : 'font-sans font-medium text-[#111827] dark:text-white'
                        }`}
                      >
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate font-sans">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono uppercase text-[#9CA3AF] ml-2 shrink-0">
                    {item.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
