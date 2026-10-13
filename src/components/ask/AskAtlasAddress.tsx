/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { InterpretedAddress } from '../../lib/address/types';
import type { MapAction } from '../../lib/tools/types';
import { NIGERIA_STATES } from '../../lib/geo/nigeriaData';

const MUTED = 'text-[#6B7280] dark:text-[#9CA3AF]';
const CODE = 'font-mono text-[#0F7B4D] dark:text-[#10B981]';

/** One resolved hierarchy level: a display label and the code in muted mono. */
interface AddressPart {
  label: string;
  code?: string;
}

/**
 * The breadcrumb levels the resolver placed, deepest last. Districts and areas
 * are code-only in NDAPS, so when a level has no name its code is the label and
 * is not repeated.
 */
function addressParts(address: InterpretedAddress): AddressPart[] {
  const parts: Array<{ label: string; code?: string }> = [];
  if (address.state) parts.push({ label: address.state.name, code: address.state.code });
  if (address.lga) parts.push({ label: address.lga.name, code: address.lga.code });
  if (address.district) {
    parts.push({ label: address.district.name ?? address.district.code, code: address.district.name ? address.district.code : undefined });
  }
  if (address.area) {
    parts.push({ label: address.area.name ?? address.area.code, code: address.area.name ? address.area.code : undefined });
  }
  return parts;
}

/**
 * The map move for the resolved state or LGA (feature 8), built from the
 * catalogue's own coordinates so the card reuses the same navigation path as
 * the other grounded replies. An LGA rides its state's center and zoom because
 * NDAPS keeps no per-LGA coordinate here. Returns nothing for an address that
 * resolved to neither, so the control only appears when there is a place to
 * show.
 */
export function addressMapAction(address: InterpretedAddress): MapAction | undefined {
  const state = address.state;
  if (!state) return undefined;
  const geo = NIGERIA_STATES[state.code.toUpperCase()];
  if (!geo) return undefined;

  if (address.lga) {
    return {
      target: 'lga',
      state: { code: state.code, name: state.name },
      lga: { code: address.lga.code, name: address.lga.name },
      center: geo.center,
      zoom: geo.zoom,
    };
  }
  return { target: 'state', state: { code: state.code, name: state.name }, center: geo.center, zoom: geo.zoom };
}

/** Props for one interpreted address. */
export interface AskAtlasAddressProps {
  address: InterpretedAddress;
  /** Applies the resolved place as a validated map move (feature 8). */
  onMapAction?: (action: MapAction) => void;
}

/**
 * Address interpretation (feature 17): the breadcrumb the NDAPS data supports,
 * a postcode chip when the address or a verified landmark carried one, the
 * parts that stayed unplaced, and a map move for a resolved state or LGA.
 * Built only from the executed `interpretAddress` result, so it never shows a
 * level or a code the data did not return, and it says so plainly when the
 * address matched nothing.
 */
export const AskAtlasAddress: React.FC<AskAtlasAddressProps> = ({ address, onMapAction }) => {
  const parts = addressParts(address);
  const action = addressMapAction(address);

  return (
    <div className="mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
      <span className={`block text-[10px] font-mono uppercase tracking-wide ${MUTED}`}>Address read</span>

      {parts.length > 0 ? (
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px]">
          {parts.map((part, index) => (
            <React.Fragment key={`${part.label}-${index}`}>
              {index > 0 && (
                <span aria-hidden="true" className={`text-[10px] ${MUTED}`}>
                  &gt;
                </span>
              )}
              <span className="text-[#111827] dark:text-[#E5E7EB]">{part.label}</span>
              {part.code && <span className={`${CODE} text-[10px]`}>{part.code}</span>}
            </React.Fragment>
          ))}
        </span>
      ) : (
        <span className={`mt-0.5 block text-[11px] ${MUTED}`}>
          Nothing in this address matched the Atlas hierarchy.
        </span>
      )}

      {address.postcode && (
        <span className="mt-1.5 block rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 dark:border-[#374151] dark:bg-[#1F2937]">
          <span className={`block font-mono text-sm font-semibold ${CODE}`}>{address.postcode.code}</span>
          <span className={`mt-0.5 block text-[10px] ${MUTED}`}>
            {address.postcode.verified ? 'Verified postcode' : 'Postcode not confirmed in the Atlas dataset'}
          </span>
          {address.landmark?.name && (
            <span className="block text-[10px] text-[#111827] dark:text-[#E5E7EB]">
              Matched landmark: {address.landmark.name}
            </span>
          )}
        </span>
      )}

      {!address.postcode && address.landmark && (
        <span className={`mt-0.5 block text-[10px] ${MUTED}`}>
          Matched landmark: {address.landmark.name ?? address.landmark.postcode}
        </span>
      )}

      {address.unresolved.length > 0 && (
        <span className="mt-1.5 block text-[10px]">
          <span className={`block ${MUTED}`}>
            NDAPS has no street or house-number index, so these parts stay unplaced:
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {address.unresolved.map((part, index) => (
              <span
                key={`${part}-${index}`}
                className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[10px] text-[#374151] dark:border-[#374151] dark:bg-[#1F2937] dark:text-[#D1D5DB]"
              >
                {part}
              </span>
            ))}
          </span>
        </span>
      )}

      {action && (
        <button
          type="button"
          onClick={() => onMapAction?.(action)}
          disabled={!onMapAction}
          title={
            onMapAction
              ? `Show ${action.target === 'lga' ? address.lga?.name : address.state?.name} on the map`
              : 'Map control is not connected in this view'
          }
          className="mt-1.5 block text-[11px] font-medium text-[#0F7B4D] enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#10B981]"
        >
          [View on map]
        </button>
      )}
    </div>
  );
};
