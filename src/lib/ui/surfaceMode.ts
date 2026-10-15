/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Where a surface sits at `md` and up. */
export type SurfacePlacement = 'side' | 'center';

/** Where a surface sits below `md`. Most surfaces become a bottom sheet. */
export type PhonePlacement = 'sheet' | 'center';

/** The presentation a surface actually renders in. */
export type SurfaceMode = 'sheet' | 'side' | 'center';

/**
 * Resolves a surface's presentation from its own placement and the viewport.
 *
 * A phone gets the bottom sheet unless the surface opts out, and only the typed
 * confirm opts out: a sheet would put its text field under the software
 * keyboard. A desktop ignores `phonePlacement` and is whatever the surface
 * asked for, because it never renders the sheet.
 */
export function resolveSurfaceMode(
  placement: SurfacePlacement,
  phonePlacement: PhonePlacement,
  isPhone: boolean,
): SurfaceMode {
  if (!isPhone) return placement;
  return phonePlacement === 'center' ? 'center' : 'sheet';
}
