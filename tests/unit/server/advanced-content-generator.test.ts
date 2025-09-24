
import { afterEach, describe, expect, it } from 'vitest';

import { applyHumanization, generateAdvancedContent, type ContentParameters, type ToneStyle, selectWeightedUniqueFragments, toneFragmentPools, photoTypeFragmentPools, generalConnectors } from '../../../server/advanced-content-generator';

type SeededRandom = () => number;

function createSeededRandom(seed: number): SeededRandom {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }
  return () => {
    state = state * 16807 % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
});

const staticContext = {
  pickDescriptor: () => 'bright',
  pickTheme: () => 'story',
  pickSetting: () => 'studio',
  pickEmoji: () => '✨',
  pickFiller: () => 'honestly',
  mood: 'calm',
  photoType: 'casual' as const
};

describe('advanced content generator helpers', () => {
  it('selectWeightedUniqueFragments favors higher weighted fragments', () => {
    const pool = [
      { id: 'dominant', weight: 6 },
      { id: 'secondary', weight: 1 },
      { id: 'tertiary', weight: 1 }
    ];

    let dominantSelections = 0;
    const iterations = 200;
    for (let index = 0; index < iterations; index += 1) {
      const [selected] = selectWeightedUniqueFragments(pool, 1);
      if (selected?.id === 'dominant') {
        dominantSelections += 1;
      }
    }

    expect(dominantSelections).toBeGreaterThan(110);
  });

  it('wraps custom prompts with contextual connectors', () => {
    const params = {
      photoType: 'casual' as const,
      textTone: 'confident' as const,
      style: 'test-style',
      includePromotion: false,
      selectedHashtags: [] as string[],
      customPrompt: 'custom snippet',
      platform: 'instagram'
    };

    const connectorSet = new Set([
      ...toneFragmentPools[params.textTone].connectors,
      ...photoTypeFragmentPools[params.photoType].connectors,
      ...generalConnectors
    ]);

    let hasConnector = false;
    for (let index = 0; index < 12 && !hasConnector; index += 1) {
      const generated = generateAdvancedContent(params).content;
      const matches = Array.from(connectorSet).some(connector =>
        generated.includes(`${connector} ${params.customPrompt}`) ||
        generated.includes(`${params.customPrompt} ${connector}`)
      );
      hasConnector = matches;
    }

    expect(hasConnector).toBe(true);
  });
});

describe('applyHumanization', () => {
  it('respects the configured maxQuirks limit', () => {
    const tone: ToneStyle = {
      starters: ['hey'],
      descriptors: ['chill'],
      endings: ['see ya'],
      emojis: ['🙂'],
      imperfectionTokens: ['lol']
    };
    const baseText = 'I had a kind of wonderful shoot. It was electric';
    const result = applyHumanization(baseText, tone, {
      maxQuirks: 1,
      random: () => 0
    });

    expect(result).toContain('...');
    expect(result).not.toContain('kinda');
    expect(result).not.toContain('lol');
  });
});

describe('generateAdvancedContent - titles', () => {
  const baseParams: ContentParameters = {
    photoType: 'casual',
    textTone: 'playful',
    style: 'custom-style',
    includePromotion: false,
    selectedHashtags: [],
    platform: 'instagram'
  };

  it('produces varied title sets across repeated runs', () => {
    const uniqueTitleGroups = new Set<string>();

    for (let index = 0; index < 12; index += 1) {
      const { titles } = generateAdvancedContent(baseParams);
      uniqueTitleGroups.add(titles.join(' | '));
    }

    expect(uniqueTitleGroups.size).toBeGreaterThan(1);
  });

  it('surfaces a broad mix of individual titles over multiple runs', () => {
    const uniqueTitles = new Set<string>();

    for (let index = 0; index < 20; index += 1) {
      const { titles } = generateAdvancedContent(baseParams);
      titles.forEach(title => uniqueTitles.add(title));
    }

    expect(uniqueTitles.size).toBeGreaterThan(5);
  });
});

describe('generateAdvancedContent humanization', () => {
  const params: ContentParameters = {
    photoType: 'casual',
    textTone: 'playful',
    style: 'test-style',
    includePromotion: false,
    selectedHashtags: ['#glow', '#mood'],
    customPrompt: undefined,
    platform: 'instagram',
    humanization: {
      maxQuirks: 3
    }
  };

  it('keeps appended hashtags intact after applying humanization', () => {
    Math.random = createSeededRandom(42);

    const result = generateAdvancedContent(params);

    expect(result.content.endsWith(' #glow #mood')).toBe(true);
    expect(JSON.stringify(result)).toContain('#glow');
  });

  it('produces deterministic content when randomness is seeded', () => {
    Math.random = createSeededRandom(24);
    const first = generateAdvancedContent(params);

    Math.random = createSeededRandom(24);
    const second = generateAdvancedContent(params);

    expect(second.content).toBe(first.content);
    expect(second.titles).toEqual(first.titles);
  });
});
