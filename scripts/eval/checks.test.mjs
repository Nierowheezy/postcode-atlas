import { describe, expect, it } from 'vitest';

import {
  FROM_TOOLS,
  VERIFIED,
  groundingLabel,
  hasSegments,
  hasToolResults,
  hasVerified,
  honestFallback,
  isNatlas,
  mentionsPlace,
  noInvented,
  noShortCode,
  notVerified,
  postcodes,
  runChecks,
} from './checks.mjs';

/**
 * Fixtures are shaped like the browser runner's `readState()` output. Keep
 * them plain objects: these checks are text in, verdict out.
 */
const state = (over = {}) => ({
  meter: 'natlas · try 1',
  reply: '',
  full: '',
  listText: '',
  breadcrumb: '',
  zoom: null,
  ...over,
});

const code = 'FC-02-D43-LG-01';

describe('postcodes', () => {
  it('extracts the dashed postcode form', () => {
    expect(postcodes(`The postcode is ${code}.`)).toEqual([code]);
  });

  it('de-duplicates repeated mentions', () => {
    expect(postcodes(`${code} and again ${code}`)).toEqual([code]);
  });

  it('ignores the spaced and compact forms', () => {
    expect(postcodes('FC 02 D43 LG 01')).toEqual([]);
    expect(postcodes('FC02D43LG01')).toEqual([]);
  });
});

describe('groundingLabel', () => {
  it('maps all five footers', () => {
    expect(groundingLabel(state({ full: 'x Verified against NIPOST postcode data' }))).toBe(
      'Verified against NIPOST',
    );
    expect(groundingLabel(state({ full: 'Map moved using NIPOST location data' }))).toBe(
      'Map moved (NIPOST location data)',
    );
    expect(groundingLabel(state({ full: 'Answered from NIPOST tool results' }))).toBe(
      'Answered from NIPOST tool results',
    );
    expect(groundingLabel(state({ full: 'Not verified against NIPOST data' }))).toBe('Not verified');
    expect(groundingLabel(state({ full: 'no footer here' }))).toBe('No data footer');
  });

  it('prefers the verified footer when two are present', () => {
    expect(groundingLabel(state({ full: `${FROM_TOOLS.source} and ${VERIFIED.source}` }))).toBe(
      'Verified against NIPOST',
    );
  });
});

describe('hasVerified and hasToolResults', () => {
  it('reads only the full transcript', () => {
    expect(hasVerified(state({ full: 'Verified against NIPOST postcode data' }))).toBe(true);
    expect(hasVerified(state({ reply: 'Verified against NIPOST postcode data' }))).toBe(false);
    expect(hasToolResults(state({ full: 'Answered from NIPOST tool results' }))).toBe(true);
    expect(hasToolResults(state({ reply: 'Answered from NIPOST tool results' }))).toBe(false);
  });
});

describe('noInvented', () => {
  it('passes a reply that names no postcode', () => {
    expect(noInvented(state({ reply: 'Ikeja has no single postcode.' }))).toBe(true);
  });

  it('fails a postcode with no verified footer', () => {
    expect(noInvented(state({ reply: `The postcode is ${code}.`, full: '🌐' }))).toBe(false);
  });

  it('passes the same postcode when the footer verifies it', () => {
    expect(
      noInvented(state({ reply: `The postcode is ${code}.`, full: 'Verified against NIPOST postcode data' })),
    ).toBe(true);
  });
});

describe('noShortCode', () => {
  it('catches the LGA short code the model used to present as a postcode', () => {
    expect(noShortCode(state({ reply: 'Ikeja is 11.' }))).toBe('reply presents a short code: 11');
  });

  it('passes a reply with no digits', () => {
    expect(noShortCode(state({ reply: 'Ikeja is an LGA in Lagos.' }))).toBe(true);
  });

  /**
   * Known limit, not a promise: the guard rejects any 1 to 3 digit run, so a
   * reply that prints a full dashed postcode is flagged too. The multilingual
   * cases it guards never print one, which is why it is safe there.
   */
  it('also flags the digit runs inside a full postcode', () => {
    expect(noShortCode(state({ reply: `Decoded ${code}` }))).toBe('reply presents a short code: 02');
  });
});

describe('isNatlas', () => {
  it('accepts the Natlas meter format', () => {
    expect(isNatlas(state({ meter: 'natlas · try 12' }))).toBe(true);
  });

  it('rejects a non-natlas provider', () => {
    expect(isNatlas(state({ meter: 'gpt-4.1 · try 1' }))).toBe(false);
  });
});

describe('hasSegments', () => {
  it('accepts a full five-part breakdown', () => {
    expect(
      hasSegments(
        state({ full: 'State: FCT, LGA: Abuja, District: D43, Area: LG, Unit: 01' }),
      ),
    ).toBe(true);
  });

  it('names the parts a partial reply is missing', () => {
    expect(hasSegments(state({ full: 'District: D43, Area: LG' }))).toBe(
      'breakdown missing: state, lga, unit',
    );
  });
});

describe('notVerified', () => {
  it('passes an editorial reply with no verified footer', () => {
    expect(notVerified(state({ full: 'NDAPS is the national addressing system.' }))).toBe(true);
  });

  it('fails an editorial reply that claims NIPOST verification', () => {
    expect(notVerified(state({ full: 'Verified against NIPOST postcode data' }))).toBe(
      'editorial answer claims NIPOST verification',
    );
  });
});

describe('mentionsPlace', () => {
  it('passes when one of the named places appears', () => {
    expect(mentionsPlace(state({ full: 'That address is in Ikeja, Lagos.' }), ['Ikeja', 'Kano'])).toBe(
      true,
    );
  });

  it('reports the names it looked for', () => {
    expect(mentionsPlace(state({ full: 'No idea.' }), ['Ikeja', 'Kano'])).toBe(
      'reply does not mention Ikeja or Kano',
    );
  });
});

describe('honestFallback', () => {
  it('accepts the wording an unknown parent gets', () => {
    expect(honestFallback(state({ full: "I couldn't find any districts for Nowhereville." }))).toBe(
      true,
    );
    expect(honestFallback(state({ full: 'There are no known districts by that name.' }))).toBe(true);
  });

  it('rejects a confident answer that invents rows', () => {
    expect(honestFallback(state({ full: 'The districts are Wuse 1, Wuse 2 and Garki.' }))).toBe(
      'no honest fallback wording',
    );
  });
});

describe('runChecks', () => {
  it('returns no failures when every check passes', () => {
    expect(
      runChecks(
        { n: 1, name: 'ok', check: () => true, check2: () => true },
        state({ meter: 'natlas · try 1' }),
      ),
    ).toEqual([]);
  });

  it('collects the reason from each failing check', () => {
    expect(
      runChecks(
        { n: 2, name: 'bad', check: () => 'first reason', check2: () => true, check3: () => 'third reason' },
        state(),
      ),
    ).toEqual(['first reason', 'third reason']);
  });

  it('requires the Auto language chip when the case names a language', () => {
    expect(
      runChecks({ n: 3, name: 'yo', language: 'Yoruba', check: () => true }, state({ full: 'hello' })),
    ).toEqual(['no auto-detect label "Auto · Yoruba"']);
    expect(
      runChecks(
        { n: 4, name: 'yo', language: 'Yoruba', check: () => true },
        state({ full: 'Auto · Yoruba detected' }),
      ),
    ).toEqual([]);
  });

  it('requires the breadcrumb and zoom when the case frames a map', () => {
    const caseDef = { n: 5, name: 'map', map: { state: 'Kano', zoomMin: 7 }, check: () => true };
    expect(runChecks(caseDef, state({ breadcrumb: 'Nigeria > Kano', zoom: 8 }))).toEqual([]);
    expect(runChecks(caseDef, state({ breadcrumb: 'Nigeria', zoom: 4 }))).toEqual([
      'breadcrumb "Nigeria" did not include Kano',
      'zoom 4 below 7',
    ]);
  });

  it('passes the before state through to the checks', () => {
    const seen = [];
    runChecks(
      { n: 6, name: 'ctx', check: (r, ctx) => (seen.push(ctx.before) && true) },
      state(),
      state({ reply: 'before' }),
    );
    expect(seen).toEqual([{ ...state(), reply: 'before' }]);
  });
});
