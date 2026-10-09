/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AtlasResultItem, AtlasResultList } from '../../lib/ask/types';

/** Most hierarchy rows to show before the "+N more" line. */
const MAX_VISIBLE_ITEMS = 12;

const LEVEL_LABELS: Record<AtlasResultList['level'], { one: string; many: string }> = {
  state: { one: 'state', many: 'states' },
  lga: { one: 'LGA', many: 'LGAs' },
  district: { one: 'district', many: 'districts' },
  area: { one: 'area', many: 'areas' },
  unit: { one: 'postcode unit', many: 'postcode units' },
};

const MUTED = 'text-[#6B7280] dark:text-[#9CA3AF]';

/** Header line: count plus level plus scope, or "matches" for a mixed list. */
function listHeading(list: AtlasResultList): string {
  const labels = LEVEL_LABELS[list.level];
  const mixed = list.items.some((item) => item.type !== list.level);
  const noun = mixed ? 'matches' : list.total === 1 ? labels.one : labels.many;
  return list.scope ? `${list.total} ${noun} in ${list.scope}` : `${list.total} ${noun}`;
}

/** One result row: name or code, its code, and optional parent context. */
const ResultRow: React.FC<{ item: AtlasResultItem }> = ({ item }) => (
  <li className="py-0.5">
    <span className="flex items-baseline justify-between gap-2">
      <span className="truncate">{item.name ?? item.code}</span>
      {item.name && (
        <span className="shrink-0 font-mono text-[10px] text-[#0F7B4D] dark:text-[#10B981]">{item.code}</span>
      )}
    </span>
    {item.parent && <span className={`block text-[10px] ${MUTED}`}>{item.parent}</span>}
  </li>
);

/** A capped list of rows plus its "+N more" tail. */
const ResultRows: React.FC<{ items: AtlasResultItem[]; hidden: number }> = ({ items, hidden }) => (
  <>
    <ul role="list" className="mt-1 space-y-0.5">
      {items.map((item) => (
        <ResultRow key={`${item.type}-${item.code}`} item={item} />
      ))}
    </ul>
    {hidden > 0 && <span className={`block text-[10px] mt-0.5 ${MUTED}`}>+{hidden} more</span>}
  </>
);

/** Props for one exploration result list. */
export interface AskAtlasResultsListProps {
  list: AtlasResultList;
}

/**
 * Exploration results (feature 5): a compact, grounded hierarchy list rendered
 * under the assistant reply, with an optional verified-units section. Built
 * only from executed tool results, so it always travels with the verified
 * footer.
 */
export const AskAtlasResultsList: React.FC<AskAtlasResultsListProps> = ({ list }) => {
  const shown = list.items.slice(0, MAX_VISIBLE_ITEMS);
  const units = list.units ?? [];
  const unitsHidden = list.unitsTotal !== undefined ? list.unitsTotal - units.length : 0;

  return (
    <div className="mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
      <span className={`block text-[10px] font-mono uppercase tracking-wide ${MUTED}`}>{listHeading(list)}</span>
      <ResultRows items={shown} hidden={list.total - shown.length} />
      {units.length > 0 && (
        <div className="mt-1.5">
          <span className={`block text-[10px] font-mono uppercase tracking-wide ${MUTED}`}>
            Known verified postcode units
          </span>
          <ResultRows items={units} hidden={unitsHidden} />
        </div>
      )}
    </div>
  );
};
