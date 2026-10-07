import React, { useState } from 'react';
import { PostcodeLocation } from '../../types/postcode';
import { X, Copy, Check, Share2, ExternalLink, Navigation2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface PostcodeInspectorProps {
  location: PostcodeLocation | null;
  onClose: () => void;
  onFlyTo?: (coords: [number, number]) => void;
}

export const PostcodeInspector: React.FC<PostcodeInspectorProps> = ({
  location,
  onClose,
  onFlyTo,
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const { showToast } = useToast();

  if (!location) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(location.postcode);
    setCopied(true);
    showToast({
      title: 'Postcode Copied',
      description: location.postcode,
      type: 'success',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?code=${encodeURIComponent(location.postcode)}`;

    // Try native Web Share API on mobile / supporting browsers
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Postcode Atlas · ${location.postcode}`,
          text: `Nigeria Digital Postcode: ${location.postcode} (${location.stateName || location.state})`,
          url,
        });
        setShared(true);
        showToast({ title: 'Postcode Shared', type: 'info' });
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }

    // Direct clipboard copy fallback
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch {
      // Legacy document.execCommand fallback
      const el = document.createElement('textarea');
      el.value = url;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }

    setShared(true);
    showToast({
      title: 'Share Link Copied',
      description: `${location.postcode} URL copied to clipboard`,
      type: 'success',
    });
    setTimeout(() => setShared(false), 2000);
  };

  const segments = location.postcode.split('-');
  const stateCode = segments[0] || location.state || '';
  const lgaCode = segments[1] || location.lga || '';
  const districtCode = segments[2] || location.district || '';
  const areaCode = segments[3] || location.area || '';
  const unitCode = segments[4] || location.unit || '';

  const googleMapsUrl =
    location.lat != null && location.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
      : undefined;

  return (
    <aside className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[340px] p-3 sm:p-4 text-[#111827] dark:text-white select-none z-30 flex flex-col gap-3 font-sans transition-smooth">
      {/* Header: Postcode in Geist Mono + Close */}
      <div className="flex items-start justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#374151]">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
            Digital Postcode (NDAPS)
          </div>
          <div className="text-base font-medium font-mono text-[#111827] dark:text-white tracking-tight mt-0.5 flex items-center gap-1.5">
            <span>{location.postcode}</span>
            {location.valid && (
              <span
                className="w-1.5 h-1.5 rounded-full inline-block bg-[#0F7B4D]"
                title="Valid NDAPS address"
              />
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded transition-colors cursor-pointer"
          aria-label="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Locality & Address */}
      <div className="text-xs">
        {location.address ? (
          <div className="font-medium text-[#111827] dark:text-white leading-relaxed">
            {location.address}
          </div>
        ) : null}
        <div className="text-[#6B7280] dark:text-[#9CA3AF] text-[11px] mt-0.5">
          {location.lgaName ? `${location.lgaName}, ` : ''}
          {location.stateName || stateCode} State
        </div>
        {location.buildingUse && (
          <div className="text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF] mt-1 capitalize">
            Usage: {location.buildingUse}
          </div>
        )}
      </div>

      {/* Clean Administrative Hierarchy Table */}
      <div className="border border-[#F3F4F6] dark:border-[#374151] rounded-md bg-[#FAFAFA] dark:bg-[#1F2937]/70 p-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#6B7280] dark:text-[#9CA3AF]">State</span>
          <span className="font-mono font-medium text-[#111827] dark:text-white">
            {location.stateName ? `${location.stateName} (${stateCode})` : stateCode}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B7280] dark:text-[#9CA3AF]">LGA</span>
          <span className="font-mono font-medium text-[#111827] dark:text-white">
            {location.lgaName ? `${location.lgaName} (${lgaCode})` : lgaCode}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B7280] dark:text-[#9CA3AF]">District (PD)</span>
          <span className="font-mono font-medium text-[#111827] dark:text-white">{districtCode || '—'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#6B7280] dark:text-[#9CA3AF]">Area (PCA)</span>
          <span className="font-mono font-medium text-[#111827] dark:text-white">{areaCode || '—'}</span>
        </div>

        {unitCode && (
          <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB] dark:border-[#374151]">
            <span className="text-[#0F7B4D] dark:text-[#10B981] font-medium">Building Unit</span>
            <span className="font-mono font-medium text-[#0F7B4D] dark:text-[#10B981]">{unitCode}</span>
          </div>
        )}
      </div>

      {/* GPS Coordinates (if available) */}
      {location.lat != null && location.lng != null && (
        <div className="text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] flex items-center justify-between px-0.5">
          <span>
            {location.lat.toFixed(5)}° N, {location.lng.toFixed(5)}° E
          </span>
          {onFlyTo && (
            <button
              onClick={() => onFlyTo([location.lat!, location.lng!])}
              className="text-[#0F7B4D] dark:text-[#10B981] hover:underline flex items-center gap-1 font-sans cursor-pointer text-[10px]"
            >
              <Navigation2 className="w-2.5 h-2.5" />
              <span>Center</span>
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-[#F3F4F6] dark:border-[#374151] grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={handleCopy}
          className="py-1.5 px-3 font-medium text-[#111827] dark:text-white bg-[#F9FAFB] dark:bg-[#1F2937] hover:bg-[#F3F4F6] dark:hover:bg-[#374151] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#0F7B4D]" />
              <span className="text-[#0F7B4D] dark:text-[#10B981]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
              <span>Copy postcode</span>
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          className="py-1.5 px-3 font-medium text-[#111827] dark:text-white bg-[#F9FAFB] dark:bg-[#1F2937] hover:bg-[#F3F4F6] dark:hover:bg-[#374151] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {shared ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#0F7B4D]" />
              <span className="text-[#0F7B4D] dark:text-[#10B981]">Link copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
              <span>Share</span>
            </>
          )}
        </button>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 py-1.5 px-3 text-center text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white bg-white dark:bg-[#111827] hover:bg-[#F9FAFB] dark:hover:bg-[#1F2937] rounded border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center justify-center gap-1 text-[11px]"
          >
            <span>Open in external maps</span>
            <ExternalLink className="w-3 h-3 text-[#9CA3AF]" />
          </a>
        )}
      </div>
    </aside>
  );
};
