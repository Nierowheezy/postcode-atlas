import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { NIGERIA_STATES } from '../../lib/geo/nigeriaData';
import { postcodeApi } from '../../lib/api/postcodeClient';
import { NamedCode, StateGeoInfo } from '../../types/postcode';
import { useToast } from '../../hooks/useToast';
import { ModalSurface } from '../ui/ModalSurface';

interface StateExplorerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectState: (state: StateGeoInfo) => void;
  onSelectLGA: (state: StateGeoInfo, lga: NamedCode) => void;
}

export const StateExplorerDrawer: React.FC<StateExplorerDrawerProps> = ({
  isOpen,
  onClose,
  onSelectState,
  onSelectLGA,
}) => {
  const [filter, setFilter] = useState('');
  const [activeState, setActiveState] = useState<StateGeoInfo | null>(null);
  const [lgas, setLgas] = useState<NamedCode[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setActiveState(null);
      setLgas([]);
      setFilter('');
    }
  }, [isOpen]);

  const handleStateClick = async (state: StateGeoInfo) => {
    setActiveState(state);
    onSelectState(state);
    setLoadingLgas(true);
    showToast({
      title: `${state.name} State`,
      description: `${state.capital} · ${state.zone}`,
      type: 'info',
    });
    try {
      const data = await postcodeApi.fetchLGAs(state.code);
      setLgas(data);
    } catch {
      setLgas([]);
    } finally {
      setLoadingLgas(false);
    }
  };

  const handleLgaClick = (state: StateGeoInfo, lga: NamedCode) => {
    onSelectLGA(state, lga);
    showToast({
      title: `${lga.name || lga.code} LGA`,
      description: `${state.name} State (${state.code}-${lga.code})`,
      type: 'info',
    });
  };

  const stateList = Object.values(NIGERIA_STATES).filter((s) =>
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.code.toLowerCase().includes(filter.toLowerCase()) ||
    s.capital.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <ModalSurface
      open={isOpen}
      onClose={onClose}
      label="Nigerian states"
      placement="side"
      desktopSize="md:w-96"
      header={
        <div className="flex items-center gap-2">
          {activeState && (
            <button
              onClick={() => {
                setActiveState(null);
                setLgas([]);
              }}
              className="p-1 -ml-1 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded-md hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors cursor-pointer"
              aria-label="Back to all states"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-sm font-semibold text-[#111827] dark:text-white">
              {activeState ? activeState.name : 'Nigerian States'}
            </h2>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">
              {activeState
                ? `${lgas.length || activeState.lgaCount} LGAs in ${activeState.name}`
                : '37 Administrative Divisions'}
            </p>
          </div>
        </div>
      }
      toolbar={
        !activeState ? (
          <div className="p-3 border-b border-[#F3F4F6] dark:border-[#1F2937] bg-[#FAFAFA] dark:bg-[#1F2937]/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter states or capital..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#111827] rounded-md border border-[#E5E7EB] dark:border-[#374151] outline-none focus:border-[#0F7B4D] focus:ring-1 focus:ring-[#0F7B4D] font-sans text-[#111827] dark:text-white placeholder:text-[#9CA3AF]"
              />
            </div>
          </div>
        ) : undefined
      }
      footer={
        <div className="p-3 border-t border-[#E5E7EB] dark:border-[#374151] bg-[#FAFAFA] dark:bg-[#1F2937]/50 text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center justify-between">
          <span>Source: NIPOST Reference API</span>
          <span className="font-mono text-[#0F7B4D] dark:text-[#10B981]">NDAPS Gateway</span>
        </div>
      }
    >
      <div className="divide-y divide-[#F3F4F6] dark:divide-[#1F2937]">
        {!activeState ? (
          // States List
          stateList.map((state) => (
            <button
              key={state.code}
              onClick={() => handleStateClick(state)}
              className="w-full text-left px-4 py-3 hover:bg-[#FAFAFA] dark:hover:bg-[#1F2937] transition-colors flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-[#F3F4F6] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white flex items-center justify-center font-mono text-xs font-semibold group-hover:bg-[#F0FDF4] group-hover:text-[#0F7B4D] group-hover:border-[#DCFCE7] dark:group-hover:bg-[#064E3B] dark:group-hover:text-[#10B981] transition-colors">
                  {state.code}
                </span>
                <div>
                  <div className="text-xs font-semibold text-[#111827] dark:text-white flex items-center gap-1.5">
                    <span>{state.name}</span>
                    <span className="text-[10px] text-[#9CA3AF] font-normal font-sans">
                      ({state.capital})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                    {state.zone} · {state.lgaCount} LGAs
                  </div>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#111827] dark:group-hover:text-white transition-colors" />
            </button>
          ))
        ) : (
          // LGAs under selected state
          <div>
            {loadingLgas ? (
              <div className="p-8 text-center text-[#9CA3AF] flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#0F7B4D] dark:text-[#10B981]" />
                <span className="text-xs font-sans">Loading official LGAs from NIPOST...</span>
              </div>
            ) : lgas.length > 0 ? (
              lgas.map((lga) => (
                <button
                  key={lga.code}
                  onClick={() => handleLgaClick(activeState, lga)}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#FAFAFA] dark:hover:bg-[#1F2937] transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs text-[#9CA3AF] group-hover:text-[#0F7B4D] dark:group-hover:text-[#10B981] w-5">
                      {lga.code}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-[#111827] dark:text-white">{lga.name}</div>
                      <div className="text-[10px] font-mono text-[#9CA3AF]">
                        {activeState.code}-{lga.code}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-[#E5E7EB] dark:text-[#374151] group-hover:text-[#6B7280] dark:group-hover:text-[#9CA3AF] transition-colors" />
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                No LGAs found for this state.
              </div>
            )}
          </div>
        )}
      </div>
    </ModalSurface>
  );
};
