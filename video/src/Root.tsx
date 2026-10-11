import React from 'react';
import { Composition } from 'remotion';
import { Demo } from './Demo';
import { DURATION, FPS, HEIGHT, WIDTH } from './theme';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PostcodeAtlasDemo"
    component={Demo}
    durationInFrames={DURATION}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
  />
);
