/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bookmark, Share2, Trash2, X } from 'lucide-react';
import type { SavedDiscovery } from '../../lib/saved/types';

interface SavedDiscoveriesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Saved discoveries, newest first. */
  items: SavedDiscovery[];
  /** Refocus the map on one discovery and close the drawer. */
  onOpenItem: (item: SavedDiscovery) => void;
  /** Remove one discovery. */
  onRemoveItem: (id: string) => void;
  /** Clear every discovery. */
  onClear: () => void;
  /** Share one discovery. Omitted until the share path is wired. */
  onShareItem?: (item: SavedDiscovery) => void;
}

/** A discovery can be shared only when it has a deep link target. */
function hasShareTarget(item: SavedDiscovery): boolean {
  return Boolean(item.postcode || item.stateCode);
}

/** One dim line under the label, describing where the discovery sits. */
function detailFor(item: SavedDiscovery): string {
  if (item.kind === 'postcode') {
    const place = [item.lgaName, item.stateName].filter(Boolean).join(', ');
    return [item.postcode, place].filter(Boolean).join(' · ');
  }
  if (item.lgaName) return `LGA in ${item.stateName || item.stateCode || ''}`.trim();
  if (item.stateName || item.stateCode) {
    return `${item.stateName || item.stateCode} State`;
  }
  if (item.lat != null && item.lng != null) {
    return `${item.lat.toFixed(3)}, ${item.lng.toFixed(3)}`;
  }
  return 'Saved location';
}

/**
 * The saved discoveries drawer (feature 20). A personal, device-local list,
 * newest first, that reopens a discovery on the map, shares it as a deep link,
 * or removes it. Item-level logic lives in the caller; this is presentation plus
 * the two-step clear confirmation.
 */
export const SavedDiscoveriesDrawer: React.FC<SavedDiscoveriesDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onOpenItem,
  onRemoveItem,
  onClear,
  onShareItem,
}) => {
  const [confirmingClear, setConfirmingClear] = useState(false);

  // Reset the confirmation whenever the drawer closes, so it never reopens armed.
  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/15 z-40"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 w-[85%] max-w-sm sm:w-88 md:w-96 bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#374151] shadow-2xl z-50 flex flex-col font-sans transition-colors safe-top safe-right safe-bottom"
            role="dialog"
            aria-label="Saved discoveries"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-[#111827] dark:text-white">
                  Saved discoveries
                </h2>
                <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                  {items.length === 1 ? '1 saved place' : `${items.length} saved places`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-md transition-colors cursor-pointer"
                aria-label="Close saved discoveries"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#F3F4F6] dark:divide-[#1F2937]">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 px-8 text-center">
                  <Bookmark className="w-6 h-6 text-[#9CA3AF] dark:text-[#6B7280]" />
                  <p className="text-xs font-medium text-[#111827] dark:text-white">
                    Nothing saved yet
                  </p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Save a postcode from the inspector or an Ask Atlas reply, and it will appear
                    here. Saves stay on this device.
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-center gap-1 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="flex-1 min-w-0 text-left px-2 py-1.5 rounded-md hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] transition-colors cursor-pointer"
                      title={`Show ${item.label} on the map`}
                    >
                      <span className="block text-xs font-medium text-[#111827] dark:text-white truncate">
                        {item.label}
                      </span>
                      <span className="block text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF] truncate">
                        {detailFor(item)}
                      </span>
                    </button>
                    {onShareItem && hasShareTarget(item) && (
                      <button
                        type="button"
                        onClick={() => onShareItem(item)}
                        className="p-1.5 text-[#9CA3AF] hover:text-[#0F7B4D] dark:hover:text-[#10B981] rounded-md transition-colors cursor-pointer shrink-0"
                        aria-label={`Share ${item.label}`}
                        title="Share a link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 text-[#9CA3AF] hover:text-[#B91C1C] dark:hover:text-[#F87171] rounded-md transition-colors cursor-pointer shrink-0"
                      aria-label={`Remove ${item.label} from saved`}
                      title="Remove from saved"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-3 border-t border-[#E5E7EB] dark:border-[#374151] shrink-0">
                {confirmingClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClear();
                        setConfirmingClear(false);
                      }}
                      className="flex-1 py-1.5 text-xs font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-md transition-colors cursor-pointer"
                    >
                      Confirm clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="px-3 py-1.5 text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded-md hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#B91C1C] dark:hover:text-[#F87171] rounded-md hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
