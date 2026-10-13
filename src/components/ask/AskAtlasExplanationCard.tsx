/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AtlasExplanation } from '../../lib/tools/types';

const MUTED = 'text-[#6B7280] dark:text-[#9CA3AF]';
const CODE = 'text-[#0F7B4D] dark:text-[#10B981]';

/** Props for one curated explanation card. */
export interface AskAtlasExplanationCardProps {
  explanation: AtlasExplanation;
}

/**
 * Curated explanation of the addressing system (feature 19): a titled, ordered
 * breakdown with an optional worked code. Editorial Atlas copy rather than a
 * NIPOST record, and the reply footer says so, so this card never reads as
 * verified data.
 */
export const AskAtlasExplanationCard: React.FC<AskAtlasExplanationCardProps> = ({ explanation }) => (
  <div className="mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
    <span className="block text-[11px] font-semibold text-[#111827] dark:text-[#F3F4F6]">
      {explanation.title}
    </span>
    <span className={`block mt-0.5 text-[11px] ${MUTED}`}>{explanation.summary}</span>

    <ol role="list" className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[11px] text-[#374151] dark:text-[#D1D5DB]">
      {explanation.points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ol>

    {explanation.example && (
      <span className={`block mt-1.5 font-mono text-[11px] ${CODE}`}>{explanation.example}</span>
    )}
  </div>
);
