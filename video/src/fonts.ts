/**
 * Geist + Geist Mono from Google Fonts, matched to the app's typography.
 * `loadFont()` blocks the first frame until the files are ready.
 */
import { loadFont as loadGeist } from '@remotion/google-fonts/Geist';
import { loadFont as loadGeistMono } from '@remotion/google-fonts/GeistMono';

const sans = loadGeist('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});
const mono = loadGeistMono('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
  ignoreTooManyRequestsWarning: true,
});

export const FONT_SANS = `${sans.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
export const FONT_MONO = `${mono.fontFamily}, ui-monospace, SFMono-Regular, Menlo, monospace`;
