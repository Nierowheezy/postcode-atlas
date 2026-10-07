import React from 'react';
import { X, ExternalLink, Layers, ShieldCheck, MapPin } from 'lucide-react';

interface DatasetStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatasetStoryModal: React.FC<DatasetStoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-lg w-full p-6 text-stone-900 select-none max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-stone-900">
              National Digital Alphanumeric Postcode System (NDAPS)
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">
              Official Architecture & Specifications · NIPOST
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 text-xs text-stone-600 leading-relaxed font-sans">
          <p>
            Nigeria's new National Digital Alphanumeric Postcode System (NDAPS), developed by the Nigerian Postal Service (NIPOST), introduces an 11-character alphanumeric addressing standard for every addressable building in the country.
          </p>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 font-mono space-y-2 text-[11px]">
            <div className="font-semibold text-stone-800 text-xs">Postcode Anatomy (Template: AA-99-H77-BB-55)</div>
            <div className="grid grid-cols-5 gap-1.5 text-center pt-1">
              <div className="p-1.5 bg-white rounded border border-stone-200">
                <div className="font-bold text-emerald-800">LA</div>
                <div className="text-[9px] text-stone-500 mt-0.5">State</div>
              </div>
              <div className="p-1.5 bg-white rounded border border-stone-200">
                <div className="font-bold text-emerald-800">11</div>
                <div className="text-[9px] text-stone-500 mt-0.5">LGA</div>
              </div>
              <div className="p-1.5 bg-white rounded border border-stone-200">
                <div className="font-bold text-emerald-800">A12</div>
                <div className="text-[9px] text-stone-500 mt-0.5">District</div>
              </div>
              <div className="p-1.5 bg-white rounded border border-stone-200">
                <div className="font-bold text-emerald-800">AK</div>
                <div className="text-[9px] text-stone-500 mt-0.5">Area</div>
              </div>
              <div className="p-1.5 bg-white rounded border border-stone-200">
                <div className="font-bold text-emerald-800">08</div>
                <div className="text-[9px] text-stone-500 mt-0.5">Building</div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 font-medium">GIS-Located & Graded Precision:</strong> The system associates physical building structures with sub-meter coordinate references, address verification, and standardized postal routing.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 font-medium">Location Identity vs Navigation:</strong> As documented by NIPOST, NDAPS acts as an authoritative identity layer for addresses, leaving vehicle routing and turn-by-turn navigation to consumer mapping platforms.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-stone-900 font-medium">Real API Connectivity:</strong> This application communicates directly with the live NIPOST API gateway (`api.postcode.gov.ng` & `platform.postcode.gov.ng`) using authorized developer credentials.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
          <a
            href="https://postcode.gov.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Official Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
