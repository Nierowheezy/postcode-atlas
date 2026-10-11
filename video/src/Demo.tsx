import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS, SCENES } from './theme';
import { Hook } from './scenes/Hook';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';
import { Grounded } from './scenes/Grounded';
import { MapDecode } from './scenes/MapDecode';
import { Outro } from './scenes/Outro';

/**
 * The 45-second demo. Scenes are laid out on one shared dark stage so cuts read
 * as content changes rather than a background flash.
 *
 * Music slot: add `video/public/music.mp3`, then import `Audio` from remotion
 * and uncomment the track below.
 */
export const Demo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Sequence from={SCENES.hook.from} durationInFrames={SCENES.hook.duration}>
      <Hook />
    </Sequence>
    <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
      <Problem />
    </Sequence>
    <Sequence from={SCENES.reveal.from} durationInFrames={SCENES.reveal.duration}>
      <Reveal />
    </Sequence>
    <Sequence from={SCENES.grounded.from} durationInFrames={SCENES.grounded.duration}>
      <Grounded />
    </Sequence>
    <Sequence from={SCENES.map.from} durationInFrames={SCENES.map.duration}>
      <MapDecode />
    </Sequence>
    <Sequence from={SCENES.outro.from} durationInFrames={SCENES.outro.duration}>
      <Outro />
    </Sequence>

    {/* <Audio src={staticFile('music.mp3')} volume={0.6} /> */}
  </AbsoluteFill>
);
