import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Body, Brand, Heading, Stage } from '../components/ui';
import { COLORS, SCENES } from '../theme';
import { enter, sceneEnvelope } from '../lib/anim';

/** Scene 1 — the hook. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.hook.duration);

  const brand = enter(frame, fps, 4, { dist: 30 });
  const line1 = enter(frame, fps, 30, { dist: 36 });
  const line2 = enter(frame, fps, 62, { dist: 36 });
  const rule = interpolate(frame, [70, 100], [0, 460], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Stage grid glow glowX="50%" glowY="16%">
      <AbsoluteFill style={{ opacity: env, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 48, padding: 120 }}>
        <div style={brand}>
          <Brand size={88} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', maxWidth: 1400 }}>
          <Heading size={110} style={line1}>
            Every Nigerian address
            <br />
            has a postcode.
          </Heading>
          <span style={{ height: 5, width: rule, borderRadius: 3, background: `linear-gradient(90deg, ${COLORS.greenDeep}, ${COLORS.greenBright})` }} />
          <Body size={42} style={{ ...line2, color: COLORS.muted, marginTop: 6 }}>
            Finding yours shouldn&apos;t need a manual.
          </Body>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
