import React from 'react';
import { Composition } from 'remotion';
import { Demo } from './Demo';
import { OpenGraphCard } from './OpenGraph';
import { Vertical, VERTICAL_HEIGHT, VERTICAL_WIDTH } from './Vertical';
import { DURATION, FPS, HEIGHT, WIDTH } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 16:9 — the main cut for LinkedIn / YouTube / the site. */}
    <Composition
      id="PostcodeAtlasDemo"
      component={Demo}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* 9:16 — the vertical cut for Reels / Shorts / TikTok. */}
    <Composition
      id="PostcodeAtlasDemoVertical"
      component={Vertical}
      durationInFrames={DURATION}
      fps={FPS}
      width={VERTICAL_WIDTH}
      height={VERTICAL_HEIGHT}
    />
    {/* 1.91:1 — the social share card, rendered to the app's public/og.png. */}
    <Composition
      id="PostcodeAtlasOG"
      component={OpenGraphCard}
      durationInFrames={1}
      fps={FPS}
      width={1200}
      height={630}
    />
  </>
);
