import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DemoVisual, Music } from './Demo';
import { COLORS, HEIGHT, WIDTH } from './theme';

/** Canvas for vertical feeds (Reels / Shorts / TikTok). */
export const VERTICAL_WIDTH = 1080;
export const VERTICAL_HEIGHT = 1920;

/** The whole 16:9 frame scaled to the vertical canvas width. */
const FIT_SCALE = VERTICAL_WIDTH / WIDTH; // 0.5625
/** The same frame scaled to fill the vertical canvas height, for the backdrop. */
const FILL_SCALE = VERTICAL_HEIGHT / HEIGHT; // 1.7778

/** One 16:9 copy of the visuals, centred on the canvas and scaled. */
const Scaled: React.FC<{ scale: number; style?: React.CSSProperties }> = ({ scale, style }) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: WIDTH,
      height: HEIGHT,
      marginLeft: -WIDTH / 2,
      marginTop: -HEIGHT / 2,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      ...style,
    }}
  >
    <DemoVisual />
  </div>
);

/**
 * 9:16 reframe of the demo. The full 16:9 composition is shown sharp, scaled to
 * the canvas width and centred, over a blurred, dimmed fill of the same frames
 * so the extra height reads as an intentional backdrop rather than empty space.
 * The soundtrack plays once, at the same fade envelope as the 16:9 cut.
 */
export const Vertical: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: 'hidden' }}>
    <Scaled scale={FILL_SCALE} style={{ filter: 'blur(64px)', opacity: 0.45 }} />
    <AbsoluteFill style={{ background: 'rgba(6, 9, 14, 0.4)' }} />
    <Scaled
      scale={FIT_SCALE}
      style={{ boxShadow: '0 40px 130px rgba(0,0,0,0.7)', outline: '1px solid rgba(255,255,255,0.06)' }}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, rgba(6,9,14,0.85) 0%, rgba(6,9,14,0) 20%, rgba(6,9,14,0) 80%, rgba(6,9,14,0.85) 100%)',
      }}
    />
    <Music />
  </AbsoluteFill>
);
