/**
 * Shared visual building blocks: stage backgrounds, the brand lockup, headings,
 * pills, product frames, and callouts.
 */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { ACCENT_GRADIENT, COLORS } from '../theme';
import { FONT_MONO, FONT_SANS } from '../fonts';

const GRID = `repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 64px)`;

const GridOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: GRID,
      maskImage: 'radial-gradient(120% 100% at 50% 0%, black 0%, transparent 78%)',
      WebkitMaskImage: 'radial-gradient(120% 100% at 50% 0%, black 0%, transparent 78%)',
    }}
  />
);

const Glow: React.FC<{ x?: string; y?: string; color?: string }> = ({ x = '78%', y = '-8%', color = COLORS.green }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(42% 46% at ${x} ${y}, ${color}44 0%, transparent 70%)`,
      filter: 'blur(6px)',
    }}
  />
);

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(130% 130% at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
);

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.05,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    }}
  />
);

/** Full-frame dark stage with optional grid, glow, and grain. */
export const Stage: React.FC<{
  children: React.ReactNode;
  grid?: boolean;
  glow?: boolean;
  glowX?: string;
  glowY?: string;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, grid, glow, glowX, glowY, color, style }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg, fontFamily: FONT_SANS, color: COLORS.white, ...style }}>
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% -10%, ${COLORS.bgLift} 0%, ${COLORS.bg} 58%)` }} />
    {glow && <Glow x={glowX} y={glowY} color={color} />}
    {grid && <GridOverlay />}
    {children}
    <Vignette />
    <Grain />
  </AbsoluteFill>
);

/** Icon + wordmark lockup (uses the real PWA app icon). */
export const Brand: React.FC<{ size?: number; wordmark?: boolean; color?: string }> = ({
  size = 76,
  wordmark = true,
  color = COLORS.white,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3 }}>
    <Img
      src={staticFile('app-icon.png')}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        boxShadow: `0 12px 40px ${COLORS.green}55`,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    />
    {wordmark && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.06 }}>
        <span style={{ fontSize: size * 0.44, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1, color }}>POSTCODE ATLAS</span>
        <span style={{ fontSize: size * 0.16, fontWeight: 500, letterSpacing: size * 0.045, lineHeight: 1, fontFamily: FONT_MONO, color: COLORS.greenBright }}>
          NIGERIAN POSTALCODE ATLAS
        </span>
      </div>
    )}
  </div>
);

/** Small mono eyebrow with a leading accent bar. */
export const Kicker: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...style }}>
    <span style={{ width: 34, height: 3, borderRadius: 2, background: ACCENT_GRADIENT }} />
    <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: COLORS.greenBright }}>
      {children}
    </span>
  </div>
);

/** Large display heading. */
export const Heading: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 86,
  style,
}) => (
  <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.06, fontWeight: 700, letterSpacing: -1.5, color: COLORS.white, ...style }}>
    {children}
  </h1>
);

/** Muted supporting copy. */
export const Body: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 30,
  style,
}) => (
  <p style={{ margin: 0, fontSize: size, lineHeight: 1.5, fontWeight: 400, color: COLORS.muted, ...style }}>{children}</p>
);

/** Rounded pill. */
export const Chip: React.FC<{ children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }> = ({
  children,
  accent,
  style,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 22px',
      borderRadius: 999,
      border: `1px solid ${accent ? COLORS.green : COLORS.line}`,
      background: accent ? `${COLORS.green}22` : 'rgba(255,255,255,0.03)',
      color: accent ? COLORS.greenBright : COLORS.white,
      fontSize: 24,
      fontWeight: 500,
      fontFamily: FONT_MONO,
      letterSpacing: 0.5,
      ...style,
    }}
  >
    {children}
  </span>
);

/** Product screenshot in a soft device-style frame. */
export const Screen: React.FC<{
  src: string;
  width: number;
  radius?: number;
  style?: React.CSSProperties;
  shadow?: boolean;
}> = ({ src, width, style, radius = 20 }) => (
  <div
    style={{
      width,
      borderRadius: radius,
      overflow: 'hidden',
      border: `1px solid ${COLORS.line}`,
      background: COLORS.bgLift,
      boxShadow: '0 60px 150px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.02)',
      ...style,
    }}
  >
    <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
  </div>
);

/** Accent leader line + label used to annotate a screenshot. */
export const Callout: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...style }}>
    <span style={{ width: 46, height: 2, background: ACCENT_GRADIENT, borderRadius: 2 }} />
    <span style={{ fontSize: 24, fontWeight: 600, color: COLORS.greenBright, letterSpacing: 0.2 }}>{children}</span>
  </div>
);
