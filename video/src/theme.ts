/**
 * Shared design tokens and scene timing for the Postcode Atlas demo video.
 * Mirrors the app's real palette (tailwind tokens in src/index.css) so the
 * video and the product read as one brand.
 */

export const COLORS = {
  bg: '#0B0F17',
  bgLift: '#0E1524',
  ink: '#111827',
  white: '#F9FAFB',
  muted: '#9CA3AF',
  faint: '#6B7280',
  line: '#1F2937',
  green: '#0F7B4D',
  greenBright: '#10B981',
  greenDeep: '#008751',
  amber: '#F59E0B',
} as const;

/** Accent gradient used on marks and underlines. */
export const ACCENT_GRADIENT = `linear-gradient(135deg, ${COLORS.greenDeep} 0%, ${COLORS.green} 55%, ${COLORS.greenBright} 100%)`;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 45 * FPS; // 1350

/** Scene windows in frames; `duration` drives each scene's own fade envelope. */
export const SCENES = {
  hook: { from: 0, duration: 195 }, //  0.0s – 6.5s
  problem: { from: 195, duration: 195 }, //  6.5s – 13.0s
  reveal: { from: 390, duration: 300 }, // 13.0s – 23.0s
  grounded: { from: 690, duration: 210 }, // 23.0s – 30.0s
  map: { from: 900, duration: 240 }, // 30.0s – 38.0s
  outro: { from: 1140, duration: 210 }, // 38.0s – 45.0s
} as const;
