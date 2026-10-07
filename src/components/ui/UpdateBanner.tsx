import React from 'react';
import { RefreshCw, X } from 'lucide-react';

interface UpdateBannerProps {
  latestVersion: string;
  isJustUpdated: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

/**
 * Tells the user a newer build exists, and offers a one-click reload.
 *
 * A long-lived SPA keeps running the JS it loaded at first paint, so without
 * this people would silently stay on a stale build indefinitely.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  latestVersion,
  isJustUpdated,
  onApply,
  onDismiss,
}) => {
  if (isJustUpdated) {
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
        <div className="bg-emerald-600/95 text-white backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-xs">
          <span>Updated to the latest version.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="bg-[#111827]/95 dark:bg-black/95 text-white backdrop-blur-md px-3 py-2 rounded-lg border border-[#374151] shadow-lg flex items-center gap-3 text-xs">
        <span className="font-mono">
          v<span className="font-semibold text-emerald-400">{latestVersion}</span> is available
        </span>
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 transition-colors font-medium cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>
        <button
          onClick={onDismiss}
          className="text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
          aria-label="Dismiss update notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};