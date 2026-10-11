import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Body, Chip, Heading, Kicker, Stage } from '../components/ui';
import { COLORS, SCENES } from '../theme';
import { enter, sceneEnvelope } from '../lib/anim';

const LEVELS = ['STATE', 'LGA', 'DISTRICT', 'AREA', 'UNIT'];

/** Scene 2 — the problem: the NDAPS hierarchy is real but hard to navigate. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.problem.duration);

  const head = enter(frame, fps, 6, { dist: 30 });
  const body = enter(frame, fps, 30, { dist: 26 });
  const codeIn = enter(frame, fps, 96, { dist: 30 });

  return (
    <Stage grid glow glowX="12%" glowY="10%">
      <AbsoluteFill style={{ opacity: env, padding: '150px 140px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 54 }}>
        <Kicker>the problem</Kicker>
        <Heading size={92} style={{ ...head, maxWidth: 1300 }}>
          One address. Five levels.
          <br />
          Eleven characters.
        </Heading>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {LEVELS.map((label, i) => {
            const e = enter(frame, fps, 40 + i * 8, { dist: 22, damping: 180 });
            return (
              <React.Fragment key={label}>
                <span style={e}>
                  <Chip>{label}</Chip>
                </span>
                <span style={{ color: COLORS.faint, fontSize: 30, opacity: enter(frame, fps, 46 + i * 8).opacity }}>→</span>
              </React.Fragment>
            );
          })}
          <div style={{ ...codeIn, display: 'flex', alignItems: 'center' }}>
            <Chip accent style={{ fontSize: 26, letterSpacing: 2, padding: '14px 26px', fontWeight: 700 }}>
              FC-02-D43-LG-01
            </Chip>
          </div>
        </div>

        <Body size={34} style={{ ...body, maxWidth: 1180 }}>
          The data is structured — but navigating five levels to reach one code takes expertise.
        </Body>
      </AbsoluteFill>
    </Stage>
  );
};
