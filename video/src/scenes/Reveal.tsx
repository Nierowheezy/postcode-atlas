import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Body, Heading, Kicker, Screen, Stage } from '../components/ui';
import { COLORS, SCENES } from '../theme';
import { FONT_MONO } from '../fonts';
import { enter, sceneEnvelope } from '../lib/anim';

/** Scene 3 — the reveal: Ask Atlas turns a lookup into a conversation. */
export const Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.reveal.duration);

  const kicker = enter(frame, fps, 8, { dist: 24 });
  const head = enter(frame, fps, 20, { dist: 30 });
  const copy = enter(frame, fps, 36, { dist: 24 });
  const screen = enter(frame, fps, 24, { dist: 54, stiffness: 90 });
  const callout = enter(frame, fps, 82, { dist: 18 });

  return (
    <Stage grid glow glowX="74%" glowY="26%">
      <AbsoluteFill style={{ opacity: env, display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '110px 140px', gap: 96 }}>
        <div style={{ flex: '1 1 46%', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={kicker}>
            <Kicker>the answer</Kicker>
          </div>
          <Heading size={82} style={head}>
            So we gave the
            <br />
            Atlas a voice.
          </Heading>
          <Body size={30} style={{ ...copy, maxWidth: 620 }}>
            Ask in plain language. The Atlas answers with data it actually retrieved — never a guess.
          </Body>

          <div
            style={{
              ...callout,
              marginTop: 14,
              display: 'inline-flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-start',
              padding: '20px 24px',
              borderRadius: 18,
              border: `1px solid ${COLORS.line}`,
              background: 'rgba(255,255,255,0.03)',
              alignSelf: 'flex-start',
            }}
          >
            <span style={{ fontFamily: FONT_MONO, fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', color: COLORS.faint }}>
              grounding footer
            </span>
            <span style={{ fontSize: 25, fontWeight: 600, color: COLORS.greenBright }}>Verified against NIPOST postcode data</span>
          </div>
        </div>

        <div style={{ flex: '1 1 54%', display: 'flex', justifyContent: 'center', ...screen }}>
          <Screen src="captures/panel-verified.png" width={544} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
