/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { DecodedPostcode } from '../../lib/tools/types';

const MUTED = 'text-[#6B7280] dark:text-[#9CA3AF]';
const CODE = 'text-[#0F7B4D] dark:text-[#10B981]';

interface SegmentCell {
  label: string;
  value: string;
}

/** The five NDAPS segments, in reading order. */
const SEGMENTS: SegmentCell[] = [
  { label: 'State', value: '' },
  { label: 'LGA', value: '' },
  { label: 'District', value: '' },
  { label: 'Area', value: '' },
  { label: 'Unit', value: '' },
];

function segmentCells(decoded: DecodedPostcode): SegmentCell[] {
  const { state, lga, district, area, unit } = decoded.segments;
  const values = [state, lga, district, area, unit];
  return SEGMENTS.map((segment, index) => ({ ...segment, value: values[index] ?? '' }));
}

/** One labelled segment code. */
const SegmentCellView: React.FC<{ cell: SegmentCell }> = ({ cell }) => (
  <li className="rounded border border-[#E5E7EB] dark:border-[#374151] px-1.5 py-1">
    <span className={`block text-[9px] uppercase tracking-wide ${MUTED}`}>{cell.label}</span>
    <span className="block font-mono text-[11px] text-[#111827] dark:text-[#F3F4F6]">{cell.value}</span>
  </li>
);

/** State and LGA names, when the decode resolved either. */
function namesLine(decoded: DecodedPostcode): string | undefined {
  const parts = [decoded.stateName, decoded.lgaName].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

const VALID_TAG =
  'text-[#0F7B4D] dark:text-[#10B981] border-[#A7F3D0] dark:border-[#065F46]';
const INVALID_TAG = 'text-[#991B1B] dark:text-[#FECACA] border-[#FECACA] dark:border-[#7F1D1D]';

function tagClass(ok: boolean): string {
  return `inline-block rounded border px-1.5 py-0.5 text-[10px] ${ok ? VALID_TAG : INVALID_TAG}`;
}

/** Props for one decoded postcode card. */
export interface AskAtlasDecodedCardProps {
  decoded: DecodedPostcode;
}

/**
 * Decoded postcode breakdown (feature 6): the five NDAPS segments, the resolved
 * location, and whether the structure and the location were actually confirmed.
 * Built from the executed `decodePostcode` result, so it never claims more than
 * the Atlas data supports.
 */
export const AskAtlasDecodedCard: React.FC<AskAtlasDecodedCardProps> = ({ decoded }) => {
  const names = namesLine(decoded);

  return (
    <div className="mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
      <span className={`block font-mono text-[12px] ${decoded.valid ? CODE : ''}`}>{decoded.postcode}</span>

      {decoded.valid ? (
        <>
          <ul role="list" className="mt-1.5 grid grid-cols-5 gap-1">
            {segmentCells(decoded).map((cell) => (
              <SegmentCellView key={cell.label} cell={cell} />
            ))}
          </ul>
          {names && <span className={`block mt-1.5 text-[10px] ${MUTED}`}>{names}</span>}
          <span className={`block mt-0.5 text-[10px] ${MUTED}`}>Also written {decoded.compact}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <span className={tagClass(true)}>Valid structure</span>
            {decoded.verified ? (
              <span className={tagClass(true)}>Location verified</span>
            ) : (
              <span className={`text-[10px] ${MUTED}`}>Location not confirmed in the Atlas dataset</span>
            )}
          </span>
        </>
      ) : (
        <>
          <span className="mt-1 flex flex-wrap gap-1">
            <span className={tagClass(false)}>Not a valid postcode</span>
          </span>
          {decoded.reason && <span className={`block mt-1 text-[10px] ${MUTED}`}>{decoded.reason}</span>}
        </>
      )}
    </div>
  );
};