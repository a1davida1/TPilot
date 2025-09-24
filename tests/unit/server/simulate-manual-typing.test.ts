
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as advancedContentGenerator from '../../../server/advanced-content-generator';
import type { ContentParameters, ToneStyle } from '../../../server/advanced-content-generator';

const { generateAdvancedContent, simulateManualTyping } = advancedContentGenerator;

const baseToneStyle: ToneStyle = {
  starters: [''],
  descriptors: [''],
  endings: [''],
  emojis: [''],
  interjections: ['lol, no wait...']
};

const createDeterministicRng = (values: number[]): (() => number) => {
  let index = 0;
  const fallback = values.length > 0 ? values[values.length - 1] : 0;
  return () => {
    const value = index < values.length ? values[index] : fallback;
    index += 1;
    return value;
  };
};

describe('simulateManualTyping', () => {
  it('returns the original content when the humanized level is zero', () => {
    const content = 'Simple draft with https://example.com and #Hashtag intact.';
    const result = simulateManualTyping(content, baseToneStyle, { humanizedLevel: 0, rng: () => 0 });

    expect(result).toBe(content);
  });

  it('injects manual typing artifacts while preserving urls and hashtags', () => {
    const content = 'Real talk, capturing magic today with friends at https://example.com drop #GlowUp for love.';
    const rng = createDeterministicRng([0, 0, 0, 0, 0, 0, 0]);

    const result = simulateManualTyping(content, baseToneStyle, { humanizedLevel: 1, rng });

    expect(result).toMatch(/no wait/i);
    expect(result).toContain('  ');
    expect(result).toContain('— wait, let me brag for a sec —');
    expect(result).toContain('(oops meant extra glow)');
    expect(result).toMatch(/~~\w+~~/);
    expect(result).toContain('https://example.com');
    expect(result).toContain('#GlowUp');
  });
});

describe('generateAdvancedContent manual typing integration', () => {
  const baseParams: ContentParameters = {
    photoType: 'casual',
    textTone: 'authentic',
    style: 'default',
    includePromotion: false,
    selectedHashtags: [],
    platform: 'instagram'
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips manual typing when humanizedLevel is not provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = generateAdvancedContent({ ...baseParams });

    expect(result.content).not.toContain('oops meant');
    expect(result.content).not.toContain('~~');
  });

  it('applies manual typing when humanizedLevel is positive', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = generateAdvancedContent({ ...baseParams, humanizedLevel: 1 });

    expect(result.content).toMatch(/oops meant|~~/);
  });
});
