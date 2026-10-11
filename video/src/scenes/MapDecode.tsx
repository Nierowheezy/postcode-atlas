import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Heading, Kicker, Screen } from '../components/ui';
import { COLORS, SCENES } from '../theme';
import { enter, sceneEnvelope } from '../lib/anim';

/** Scene 5 — the Atlas does more than talk: it moves the map and decodes codes. */
export const MapDecode: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const env = sceneEnvelope(frame, SCENES.map.duration, 10, 12);

  const scale = interpolate(frame, [0, SCENES.map.duration], [1.05, 1.17], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const kicker = enter(frame, fps, 8, { dist: 24 });
  const head = enter(frame, fps, 20, { dist: 30 });
  const copy = enter(frame, fps, 36, { dist: 24 });
  const card = enter(frame, fps, 48, { dist: 60, stiffness: 84 });

  return (
    <AbsoluteFill style={{ opacity: env, backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <Img
          src={staticFile('captures/app-lagos-light.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(11,15,23,0.97) 0%, rgba(11,15,23,0.86) 32%, rgba(11,15,23,0.35) 60%, rgba(11,15,23,0.05) 100%)',
        }}
      />

      <AbsoluteFill style={{ padding: '150px 140px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 26, width: '66%' }}>
        <div style={kicker}>
          <Kicker>more than answers</Kicker>
        </div>
        <Heading size={82} style={head}>
          It moves the map.
          <br />
          It decodes any code.
        </Heading>
        <p style={{ margin: 0, fontSize: 29, lineHeight: 1.5, color: '#D1D5DB', maxWidth: 660, ...copy }}>
          Every reply can drive the Atlas — and every postcode breaks into its five NDAPS segments, verified.
        </p>
      </AbsoluteFill>

      <div style={{ position: 'absolute', right: 132, bottom: 118, ...card }}>
        <div style={{ filter: 'drop-shadow(0 50px 120px rgba(0,0,0,0.65))' }}>
          <Screen src="captures/panel-decode.png" width={446} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
