import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Body, Brand, Chip, Heading, Kicker, Stage } from '../components/ui';
import { COLORS, SCENES } from '../theme';
import { FONT_MONO } from '../fonts';
import { enter, sceneEnvelope } from '../lib/anim';

const LANGS = ['EN', 'YO', 'HA', 'IG'];

/** Scene 6 — the differentiator and the call to action. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.outro.duration, 10, 12);

  const brand = enter(frame, fps, 6, { dist: 30 });
  const kicker = enter(frame, fps, 20, { dist: 24 });
  const head = enter(frame, fps, 30, { dist: 30 });
  const sub = enter(frame, fps, 48, { dist: 24 });
  const url = enter(frame, fps, 92, { dist: 20 });
  const foot = enter(frame, fps, 104, { dist: 18 });

  return (
    <Stage grid glow glowX="50%" glowY="16%">
      <AbsoluteFill style={{ opacity: env, padding: '120px 140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <div style={enter(frame, fps, 4, { dist: 26 })}>
          <Brand size={82} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center', maxWidth: 1400 }}>
          <div style={kicker}>
            <Kicker>sovereign &amp; multilingual</Kicker>
          </div>
          <Heading size={88} style={head}>
            Powered end-to-end by N-ATLAS.
          </Heading>
          <Body size={30} style={{ ...enter(frame, fps, 44, { dist: 22 }), maxWidth: 1000, textAlign: 'center' }}>
            Nigeria's own open multilingual model — by Awarri &amp; NCAIR — understands the request. The Atlas retrieves the truth.
          </Body>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {LANGS.map((lang, i) => (
            <Chip key={lang} accent style={{ ...enter(frame, fps, 78 + i * 7, { dist: 16 }), fontSize: 24, padding: '12px 26px' }}>
              {lang}
            </Chip>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 8 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 34, fontWeight: 600, color: COLORS.greenBright, letterSpacing: 1 }}>
            nigerian-postalcode-atlas.vercel.app
          </span>
          <span style={{ fontSize: 22, color: COLORS.faint, letterSpacing: 0.4 }}>
            Free &amp; open source · grounded in NIPOST data · built for the N-ATLAS Challenge
          </span>
          <span style={{ ...enter(frame, fps, 116, { dist: 14 }), fontSize: 16, color: COLORS.faint, letterSpacing: 0.4 }}>
            Music: "Inspired" by Kevin MacLeod (incompetech.com) · CC BY 4.0
          </span>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
