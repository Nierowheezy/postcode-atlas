import { useEffect, useState } from 'react';

/** Matches Tailwind's `md` breakpoint. Below it a surface is on a phone. */
export const PHONE_QUERY = '(max-width: 767px)';

/**
 * Whether the viewport is in the phone band.
 *
 * The surface shell needs this in JavaScript rather than only in CSS because a
 * sheet and a drawer animate in from different edges, and motion properties
 * cannot be chosen by a media query. It subscribes, so rotating a phone or
 * resizing a window re-resolves the presentation.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
