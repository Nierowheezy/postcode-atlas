import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface SelectOption {
  code: string;
  name?: string;
  subtitle?: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  monoCode?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  loading = false,
  disabled = false,
  monoCode = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 120);
    return () => clearTimeout(timer);
  }, [search]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
      e.preventDefault();
      onChange(filteredOptions[0].code);
      setIsOpen(false);
    }
  };

  const selectedOption = useMemo(
    () => options.find((opt) => opt.code === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!debouncedSearch) return options;
    return options.filter((opt) => {
      const matchCode = opt.code.toLowerCase().includes(debouncedSearch);
      const matchName = opt.name ? opt.name.toLowerCase().includes(debouncedSearch) : false;
      const matchSub = opt.subtitle ? opt.subtitle.toLowerCase().includes(debouncedSearch) : false;
      return matchCode || matchName || matchSub;
    });
  }, [options, debouncedSearch]);

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative w-full text-xs font-sans ${isOpen ? 'z-40' : 'z-10'}`}
    >
      <label className="block text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[38px] py-2 px-3 bg-white dark:bg-[#111827] rounded-lg border transition-all text-left flex items-center justify-between gap-2 shadow-xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 dark:border-emerald-500 ring-2 ring-emerald-500/15'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-zinc-50 dark:bg-zinc-800' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Loading from NIPOST...</span>
            </div>
          ) : selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <span
                className={`px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-[11px] font-bold border border-zinc-200/80 dark:border-zinc-700 shrink-0 ${
                  monoCode ? 'font-mono' : ''
                }`}
              >
                {selectedOption.code}
              </span>
              {selectedOption.name && (
                <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate">
                  {selectedOption.name}
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#111827] rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-xl z-50 overflow-hidden"
          >
            {/* Search Input Box */}
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to filter..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md outline-none focus:border-emerald-600 dark:focus:border-emerald-500 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = opt.code === value;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        onChange(opt.code);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold ${
                            isSelected
                              ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          } ${monoCode ? 'font-mono' : ''}`}
                        >
                          {opt.code}
                        </span>
                        {opt.name && (
                          <span className="truncate text-xs">{opt.name}</span>
                        )}
                        {opt.subtitle && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {opt.subtitle}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No matching options found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
