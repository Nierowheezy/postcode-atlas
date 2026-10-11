/**
 * The social share card (Open Graph / Twitter Card image).
 *
 * Static by design: no frame hooks, so `remotion still` renders the finished
 * card at frame 0. The app's `public/og.jpg` is generated from this via
 * `npm run og`, so the link preview always matches the product brand.
 *
 * Layout is centre-weighted with the brand on top, the headline in the middle
 * and the URL at the bottom, so it still reads well when a client crops it to a
 * square (WhatsApp) instead of the full 1.91:1 (LinkedIn, X, Slack, Discord).
 */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { ACCENT_GRADIENT, COLORS } from './theme';
import { FONT_MONO } from './fonts';
import { Body, Brand, Chip, Heading, Kicker } from './components/ui';

const LANGS = ['EN', 'YO', 'HA', 'IG'];
const SITE = 'nigerian-postalcode-atlas.vercel.app';

export const OpenGraphCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Img
      src={staticFile('captures/app-lagos-dark.png')}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, rgba(6,9,14,0.88) 0%, rgba(6,9,14,0.72) 46%, rgba(6,9,14,0.94) 100%)',
      }}
    />
    <AbsoluteFill style={{ background: `radial-gradient(60% 70% at 50% 42%, ${COLORS.green}30 0%, transparent 70%)` }} />

    <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <Brand size={56} />
    </div>

    <AbsoluteFill
      style={{
        padding: '0 96px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        textAlign: 'center',
      }}
    >
      <Kicker style={{ justifyContent: 'center' }}>N-ATLAS powered</Kicker>
      <Heading size={126} style={{ textShadow: '0 6px 30px rgba(0,0,0,0.5)' }}>
        Ask Atlas
      </Heading>
      <Body size={30} style={{ maxWidth: 860, color: '#D6DEE6' }}>
        States, LGAs, districts, landmarks and postcodes — answers grounded in NIPOST data.
      </Body>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {LANGS.map((lang) => (
          <Chip key={lang} accent style={{ fontSize: 20, padding: '9px 18px' }}>
            {lang}
          </Chip>
        ))}
      </div>
    </AbsoluteFill>

    <div
      style={{
        position: 'absolute',
        bottom: 46,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <span style={{ width: 38, height: 3, borderRadius: 2, background: ACCENT_GRADIENT }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 600, color: COLORS.greenBright, letterSpacing: 0.6 }}>
        {SITE}
      </span>
    </div>
  </AbsoluteFill>
);
