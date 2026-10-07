import React, { useState, useEffect } from 'react';
import { X, Wrench, ArrowRight, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { postcodeApi } from '../../lib/api/postcodeClient';
import { NamedCode, PostcodeSegments } from '../../types/postcode';
import { NIGERIA_STATES } from '../../lib/geo/nigeriaData';
import { SearchableSelect, SelectOption } from '../ui/SearchableSelect';
import { useToast } from '../../hooks/useToast';

interface PostcodeAssemblyDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onFlyToState: (stateCode: string) => void;
  onLookupCode: (code: string) => void;
}

export const PostcodeAssemblyDrawer: React.FC<PostcodeAssemblyDrawerProps> = ({
  isOpen,
  onClose,
  onFlyToState,
  onLookupCode,
}) => {
  const [mode, setMode] = useState<'assemble' | 'disassemble'>('assemble');
  const { showToast } = useToast();

  // Assembly state
  const [states, setStates] = useState<NamedCode[]>([]);
  const [selectedState, setSelectedState] = useState('LA');
  const [lgas, setLgas] = useState<NamedCode[]>([]);
  const [selectedLga, setSelectedLga] = useState('11');
  const [districts, setDistricts] = useState<NamedCode[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('A12');
  const [areas, setAreas] = useState<NamedCode[]>([]);
  const [selectedArea, setSelectedArea] = useState('AK');
  const [selectedUnit, setSelectedUnit] = useState('08');

  const [loadingLgas, setLoadingLgas] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [assembledResult, setAssembledResult] = useState<{
    postcode: string;
    display: string;
    compact: string;
  } | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Disassembly state
  const [inputCode, setInputCode] = useState('LA-11-A12-AK-08');
  const [disassembledResult, setDisassembledResult] = useState<PostcodeSegments | null>(null);
  const [isDisassembling, setIsDisassembling] = useState(false);

  // Load states on mount
  useEffect(() => {
    if (isOpen) {
      postcodeApi.fetchStates().then((data) => {
        if (data.length > 0) setStates(data);
      });
    }
  }, [isOpen]);

  // Load LGAs when state changes
  useEffect(() => {
    if (selectedState && isOpen) {
      setLoadingLgas(true);
      postcodeApi.fetchLGAs(selectedState).then((data) => {
        setLgas(data);
        if (data.length > 0) {
          setSelectedLga(data[0].code);
        }
        setLoadingLgas(false);
      });
    }
  }, [selectedState, isOpen]);

  // Load districts when LGA changes
  useEffect(() => {
    if (selectedState && selectedLga && isOpen) {
      setLoadingDistricts(true);
      postcodeApi.fetchDistricts(selectedState, selectedLga).then((data) => {
        setDistricts(data);
        if (data.length > 0) {
          setSelectedDistrict(data[0].code);
        }
        setLoadingDistricts(false);
      });
    }
  }, [selectedState, selectedLga, isOpen]);

  // Load areas when district changes
  useEffect(() => {
    if (selectedState && selectedLga && selectedDistrict && isOpen) {
      setLoadingAreas(true);
      postcodeApi.fetchAreas(selectedState, selectedLga, selectedDistrict).then((data) => {
        setAreas(data);
        if (data.length > 0) {
          setSelectedArea(data[0].code);
        }
        setLoadingAreas(false);
      });
    }
  }, [selectedState, selectedLga, selectedDistrict, isOpen]);

  const handleAssemble = async () => {
    setIsAssembling(true);
    try {
      const res = await postcodeApi.assemble({
        state: selectedState,
        lga: selectedLga,
        district: selectedDistrict,
        area: selectedArea,
        unit: selectedUnit,
      });
      setAssembledResult(res);
      if (res?.postcode) {
        showToast({
          title: 'Assembled Postcode',
          description: res.postcode,
          type: 'success',
        });
      }
    } catch {
      setAssembledResult(null);
      showToast({ title: 'Assembly failed', type: 'error' });
    } finally {
      setIsAssembling(false);
    }
  };

  const handleDisassemble = async () => {
    if (!inputCode.trim()) return;
    setIsDisassembling(true);
    try {
      const res = await postcodeApi.disassemble(inputCode.trim());
      setDisassembledResult(res);
      if (res?.state) {
        showToast({
          title: 'Disassembled',
          description: `${res.state} / ${res.lga} / ${res.district} / ${res.area} / #${res.unit}`,
          type: 'success',
        });
      }
    } catch {
      setDisassembledResult(null);
      showToast({ title: 'Disassembly failed', type: 'error' });
    } finally {
      setIsDisassembling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast({ title: 'Copied to clipboard', description: text, type: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert states to options
  const stateOptions: SelectOption[] = states.map((s) => {
    const geo = NIGERIA_STATES[s.code];
    return {
      code: s.code,
      name: s.name,
      subtitle: geo ? `${geo.capital} · ${geo.zone}` : undefined,
    };
  });

  const lgaOptions: SelectOption[] = lgas.map((l) => ({
    code: l.code,
    name: l.name,
  }));

  const districtOptions: SelectOption[] = districts.map((d) => ({
    code: d.code,
    name: `Postal District ${d.code}`,
  }));

  const areaOptions: SelectOption[] = areas.map((a) => ({
    code: a.code,
    name: `Postcode Area ${a.code}`,
  }));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-xs z-40"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 w-full sm:w-96 md:w-[420px] bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#374151] shadow-2xl z-50 flex flex-col font-sans transition-colors"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#E5E7EB] dark:border-[#374151] flex items-center justify-between bg-white dark:bg-[#111827] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#F0FDF4] dark:bg-[#064E3B] border border-[#DCFCE7] dark:border-[#065F46] flex items-center justify-center text-[#0F7B4D] dark:text-[#10B981]">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-white">
                    NDAPS Assembly Engine
                  </h3>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                    Official NIPOST Assembly & Disassembly
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-md transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Mode Tabs */}
            <div className="p-2 border-b border-[#F3F4F6] dark:border-[#374151] bg-[#FAFAFA] dark:bg-[#1F2937]/50 flex gap-1 shrink-0">
              <button
                onClick={() => setMode('assemble')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'assemble'
                    ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs border border-[#E5E7EB] dark:border-[#4B5563]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                Assemble Segments
              </button>
              <button
                onClick={() => setMode('disassemble')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  mode === 'disassemble'
                    ? 'bg-white dark:bg-[#374151] text-[#111827] dark:text-white shadow-xs border border-[#E5E7EB] dark:border-[#4B5563]'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                Disassemble Code
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-32">
              {mode === 'assemble' ? (
                <>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Select 5 administrative tiers to build and validate an official 11-character Nigerian postcode.
                  </p>

                  {/* Live Anatomy Pill Bar */}
                  <div className="p-2.5 bg-[#FAFAFA] dark:bg-[#1F2937]/50 rounded-lg border border-[#E5E7EB] dark:border-[#374151] space-y-1">
                    <span className="text-[10px] uppercase font-mono text-[#9CA3AF] dark:text-[#9CA3AF] block font-semibold">
                      Live Composition Preview
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-[#111827] dark:text-white">
                      <span className="text-[#0F7B4D] dark:text-[#10B981] bg-[#DCFCE7] dark:bg-[#064E3B] px-1 rounded">{selectedState}</span>
                      <span>·</span>
                      <span className="text-[#0F7B4D] dark:text-[#10B981] bg-[#DCFCE7] dark:bg-[#064E3B] px-1 rounded">{selectedLga}</span>
                      <span>·</span>
                      <span className="text-[#0F7B4D] dark:text-[#10B981] bg-[#DCFCE7] dark:bg-[#064E3B] px-1 rounded">{selectedDistrict}</span>
                      <span>·</span>
                      <span className="text-[#0F7B4D] dark:text-[#10B981] bg-[#DCFCE7] dark:bg-[#064E3B] px-1 rounded">{selectedArea}</span>
                      <span>·</span>
                      <span className="text-[#0F7B4D] dark:text-[#10B981] bg-[#DCFCE7] dark:bg-[#064E3B] px-1 rounded">{selectedUnit || '01'}</span>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-1">
                    {/* 1. State */}
                    <SearchableSelect
                      label="1. State (2-Letter Code)"
                      value={selectedState}
                      options={stateOptions}
                      onChange={setSelectedState}
                      placeholder="Select State..."
                    />

                    {/* 2. LGA */}
                    <SearchableSelect
                      label="2. LGA (2-Digit Code)"
                      value={selectedLga}
                      options={lgaOptions}
                      onChange={setSelectedLga}
                      loading={loadingLgas}
                      placeholder="Select LGA..."
                    />

                    {/* 3. District */}
                    <SearchableSelect
                      label="3. District (PD Code)"
                      value={selectedDistrict}
                      options={districtOptions}
                      onChange={setSelectedDistrict}
                      loading={loadingDistricts}
                      placeholder="Select District..."
                    />

                    {/* 4. Area */}
                    <SearchableSelect
                      label="4. Area (PCA Code)"
                      value={selectedArea}
                      options={areaOptions}
                      onChange={setSelectedArea}
                      loading={loadingAreas}
                      placeholder="Select Area..."
                    />

                    {/* 5. Building Unit */}
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                        5. Building Unit (01 - 99)
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                        className="w-full min-h-[38px] py-2 px-3 bg-white dark:bg-[#111827] rounded-lg border border-zinc-300 dark:border-zinc-700 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-xs"
                        placeholder="01"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAssemble}
                      disabled={isAssembling}
                      className="w-full py-3 bg-[#0F7B4D] hover:bg-[#0D6D44] active:bg-[#0A5736] text-white rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md mt-4 select-none"
                    >
                      {isAssembling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Assemble via NIPOST API</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* Assembly Result */}
                    {assembledResult && (
                      <div className="p-3.5 bg-[#F0FDF4] dark:bg-[#064E3B]/40 rounded-lg border border-[#DCFCE7] dark:border-[#065F46] space-y-2 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#0F7B4D] dark:text-[#10B981] uppercase font-bold">
                            Official Canonical Postcode
                          </span>
                          <button
                            onClick={() => copyToClipboard(assembledResult.postcode)}
                            className="text-[#0F7B4D] dark:text-[#10B981] hover:underline flex items-center gap-1 text-[11px] font-mono cursor-pointer font-semibold"
                          >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        <div className="text-base font-bold font-mono text-[#111827] dark:text-white tracking-wider">
                          {assembledResult.postcode}
                        </div>

                        <div className="text-[11px] text-[#4B5563] dark:text-[#D1D5DB] font-mono">
                          Display: {assembledResult.display} · Compact: {assembledResult.compact}
                        </div>

                        <div className="pt-2 flex gap-2">
                          <button
                            onClick={() => onLookupCode(assembledResult.postcode)}
                            className="flex-1 py-1.5 text-[11px] font-medium bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-md hover:bg-black dark:hover:bg-zinc-200 transition-colors cursor-pointer"
                          >
                            Lookup & Inspect
                          </button>
                          <button
                            onClick={() => onFlyToState(selectedState)}
                            className="py-1.5 px-3 text-[11px] font-medium bg-white dark:bg-[#1F2937] text-[#111827] dark:text-white border border-[#E5E7EB] dark:border-[#374151] rounded-md hover:bg-[#F9FAFB] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                          >
                            Fly to State
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                    Disassemble any 11-character Nigerian postcode into its 5 geographic tiers via the official NIPOST disassembly endpoint.
                  </p>

                  <div className="space-y-3.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-600 dark:text-zinc-400 mb-1 font-semibold">
                        Postcode (e.g. LA-11-A12-AK-08 or EK-01-A03-FK-01)
                      </label>
                      <input
                        type="text"
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        placeholder="LA-11-A12-AK-08"
                        className="w-full min-h-[38px] py-2 px-3 bg-white dark:bg-[#111827] rounded-lg border border-zinc-300 dark:border-zinc-700 outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-zinc-900 dark:text-zinc-100 font-mono font-bold text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDisassemble}
                      disabled={isDisassembling}
                      className="w-full py-3 bg-[#111827] hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-zinc-200 text-white rounded-lg transition-colors font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isDisassembling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Disassemble via NIPOST API</span>
                        </>
                      )}
                    </button>

                    {disassembledResult && (
                      <div className="p-3.5 bg-[#FAFAFA] dark:bg-[#1F2937]/50 rounded-lg border border-[#E5E7EB] dark:border-[#374151] space-y-2 mt-3 font-mono text-xs">
                        <div className="text-[10px] text-[#9CA3AF] uppercase font-bold">
                          Resolved Segments
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[#111827] dark:text-white">
                          <div className="p-2 bg-white dark:bg-[#111827] rounded border border-[#E5E7EB] dark:border-[#374151]">
                            <span className="text-[#9CA3AF] text-[10px] block font-sans">State:</span>
                            <span className="font-bold">{disassembledResult.state}</span>
                          </div>
                          <div className="p-2 bg-white dark:bg-[#111827] rounded border border-[#E5E7EB] dark:border-[#374151]">
                            <span className="text-[#9CA3AF] text-[10px] block font-sans">LGA:</span>
                            <span className="font-bold">{disassembledResult.lga}</span>
                          </div>
                          <div className="p-2 bg-white dark:bg-[#111827] rounded border border-[#E5E7EB] dark:border-[#374151]">
                            <span className="text-[#9CA3AF] text-[10px] block font-sans">District:</span>
                            <span className="font-bold">{disassembledResult.district}</span>
                          </div>
                          <div className="p-2 bg-white dark:bg-[#111827] rounded border border-[#E5E7EB] dark:border-[#374151]">
                            <span className="text-[#9CA3AF] text-[10px] block font-sans">Area:</span>
                            <span className="font-bold">{disassembledResult.area}</span>
                          </div>
                        </div>

                        <div className="p-2 bg-[#F0FDF4] dark:bg-[#064E3B]/40 rounded border border-[#DCFCE7] dark:border-[#065F46] text-[#0F7B4D] dark:text-[#10B981] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-[#0F7B4D] dark:text-[#10B981] block font-sans font-medium">
                              Building Structure:
                            </span>
                            <span className="font-bold">Unit #{disassembledResult.unit}</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(inputCode)}
                            className="text-[11px] hover:underline font-semibold cursor-pointer"
                          >
                            Copy code
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            if (disassembledResult.state) {
                              onFlyToState(disassembledResult.state);
                              onClose();
                            }
                          }}
                          className="w-full mt-2 py-2 text-xs font-semibold bg-[#0F7B4D] text-white rounded-md hover:bg-[#0D6D44] transition-colors cursor-pointer"
                        >
                          Fly to State ({disassembledResult.state})
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#E5E7EB] dark:border-[#374151] bg-[#FAFAFA] dark:bg-[#1F2937]/50 text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center justify-between shrink-0">
              <span>NDAPS Standards v1.0</span>
              <span className="font-mono text-[#0F7B4D] dark:text-[#10B981] font-semibold">api.postcode.gov.ng</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
