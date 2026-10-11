import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Body, Heading, Kicker, Screen, Stage } from '../components/ui';
import { ACCENT_GRADIENT, COLORS, SCENES } from '../theme';
import { FONT_MONO } from '../fonts';
import { enter, sceneEnvelope } from '../lib/anim';

const ITEMS = [
  "Every fact is retrieved from NIPOST's NDAPS data",
  "Nothing is answered from the model's memory",
  'Unverifiable replies are labelled honestly',
  'It asks a question instead of guessing',
];

/** Scene 4 — the differentiator: grounded by construction. */
export const Grounded: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.grounded.duration);

  const kicker = enter(frame, fps, 8, { dist: 24 });
  const head = enter(frame, fps, 20, { dist: 30 });
  const screen = enter(frame, fps, 26, { dist: 50, stiffness: 90 });

  return (
    <Stage grid glow glowX="22%" glowY="12%">
      <AbsoluteFill style={{ opacity: env, display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '110px 140px', gap: 100 }}>
        <div style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div style={kicker}>
            <Kicker>grounded by construction</Kicker>
          </div>
          <Heading size={84} style={head}>
            It never invents
            <br />
            a postcode.
          </Heading>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 4 }}>
            {ITEMS.map((item, i) => {
              const row = enter(frame, fps, 44 + i * 12, { dist: 20 });
              return (
                <div key={item} style={{ ...row, display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: ACCENT_GRADIENT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#03150C',
                      fontWeight: 800,
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ fontSize: 29, color: '#D1D5DB' }}>{item}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: '1 1 42%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
          <div style={screen}>
            <Screen src="captures/panel-refusal.png" width={470} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontFamily: FONT_MONO,
              fontSize: 19,
              color: COLORS.amber,
              letterSpacing: 0.5,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 6, background: COLORS.amber }} />
            labelled — not fabricated
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
