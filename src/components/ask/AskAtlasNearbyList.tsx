/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { NearbyResultItem, NearbyResultList } from '../../lib/ask/types';

/** Most nearby rows to show before the "+N more" line, matching the feature 5 list. */
const MAX_VISIBLE_ITEMS = 12;

const MUTED = 'text-[#6B7280] dark:text-[#9CA3AF]';
const CODE = 'font-mono text-[#0F7B4D] dark:text-[#10B981]';

/** "within 250 m of 9.0579, 7.4937", or the radius alone when the origin is unknown. */
function originLine(list: NearbyResultList): string {
  const radius = `${list.radius_m ?? 0} m`;
  if (!list.origin) return `within ${radius}`;
  return `within ${radius} of ${list.origin.lat}, ${list.origin.lng}`;
}

/** One nearby unit row: postcode, address, parent, and distance. */
const NearbyRow: React.FC<{ item: NearbyResultItem }> = ({ item }) => (
  <li className="py-0.5">
    <span className="flex items-baseline justify-between gap-2">
      <span className={`truncate ${CODE} text-[11px]`}>{item.postcode}</span>
      {item.distance_m !== undefined && (
        <span className={`shrink-0 text-[10px] ${MUTED}`}>{Math.round(item.distance_m)} m away</span>
      )}
    </span>
    {item.label && <span className="block text-[10px] text-[#111827] dark:text-[#E5E7EB]">{item.label}</span>}
    {item.parent && <span className={`block text-[10px] ${MUTED}`}>{item.parent}</span>}
  </li>
);

/** Props for one nearby unit list. */
export interface AskAtlasNearbyListProps {
  list: NearbyResultList;
}

/**
 * Nearby postcode units (feature 7): a compact list of what the gateway
 * returned around one coordinate, with the origin and each distance shown.
 * Built only from the executed `getNearby` result, and honest when nothing
 * was returned.
 */
export const AskAtlasNearbyList: React.FC<AskAtlasNearbyListProps> = ({ list }) => {
  const shown = list.items.slice(0, MAX_VISIBLE_ITEMS);
  const hidden = list.total - shown.length;

  return (
    <div className="mt-1.5 pt-1.5 border-t border-[#E5E7EB] dark:border-[#374151]">
      <span className={`block text-[10px] font-mono uppercase tracking-wide ${MUTED}`}>
        {list.total === 0 ? 'Nearby units' : `${list.total} nearby unit${list.total === 1 ? '' : 's'}`}
      </span>
      <span className={`block text-[10px] ${MUTED}`}>{originLine(list)}</span>

      {shown.length > 0 ? (
        <>
          <ul role="list" className="mt-1 space-y-0.5">
            {shown.map((item) => (
              <NearbyRow key={item.postcode} item={item} />
            ))}
          </ul>
          {hidden > 0 && <span className={`block text-[10px] mt-0.5 ${MUTED}`}>+{hidden} more</span>}
        </>
      ) : (
        <span className="block mt-1 text-[10px] text-[#111827] dark:text-[#E5E7EB]">
          No verified units within that range.
        </span>
      )}
    </div>
  );
};