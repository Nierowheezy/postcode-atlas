import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, SCENES } from './theme';
import { Hook } from './scenes/Hook';
import { Problem } from './scenes/Problem';
import { Reveal } from './scenes/Reveal';
import { Grounded } from './scenes/Grounded';
import { MapDecode } from './scenes/MapDecode';
import { Outro } from './scenes/Outro';

const MUSIC_VOLUME = 0.55;
const FADE_IN_FRAMES = 20; //  ~0.7s
const FADE_OUT_FRAMES = 50; // ~1.7s

/**
 * Background track: "Inspired" by Kevin MacLeod (incompetech.com), licensed
 * under Creative Commons Attribution 4.0 (CC BY 4.0). The full track is trimmed
 * to the composition length at capture time in `public/music.mp3`. To swap it,
 * drop another MP3 in as `public/music.mp3` — no code change needed.
 *
 * A short fade in and a longer fade out keep the cut from feeling abrupt.
 */
const Music: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const volume = interpolate(
    frame,
    [0, FADE_IN_FRAMES, durationInFrames - FADE_OUT_FRAMES, durationInFrames],
    [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return <Audio src={staticFile('music.mp3')} volume={volume} />;
};

/**
 * The 45-second demo. Scenes are laid out on one shared dark stage so cuts read
 * as content changes rather than a background flash.
 */
export const Demo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Music />

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
  </AbsoluteFill>
);
