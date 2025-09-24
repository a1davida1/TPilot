
import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateAdvancedContent, type ContentParameters } from '../../../server/advanced-content-generator';

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let result = Math.imul(state ^ (state >>> 15), state | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_PARAMS: ContentParameters = {
  photoType: 'casual',
  textTone: 'confident',
  style: 'custom-style',
  includePromotion: false,
  selectedHashtags: [],
  customPrompt: 'Custom prompt synergy check.',
  platform: 'twitter'
};

const HASHTAGS = ['MorningLight', '#BehindTheScenes', 'ConfidenceGoals'];

describe('generateMainContent hashtag formatting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('embeds inline hashtags for twitter-style content', () => {
    const random = createSeededRandom(1337);
    vi.spyOn(Math, 'random').mockImplementation(random);

    const result = generateAdvancedContent({
      ...BASE_PARAMS,
      platform: 'twitter',
      selectedHashtags: HASHTAGS
    });

    expect(result.content).toContain('#');
    expect(result.content).not.toContain('\n\n');
  });

  it('places hashtags below blank lines for instagram layouts', () => {
    const random = createSeededRandom(2024);
    vi.spyOn(Math, 'random').mockImplementation(random);

    const result = generateAdvancedContent({
      ...BASE_PARAMS,
      platform: 'instagram',
      selectedHashtags: HASHTAGS
    });

    expect(result.content).toContain('\n\n');
    expect(result.content).toContain('#');
  });

  it('hides hashtags behind a dot ladder for tiktok style', () => {
    const random = createSeededRandom(99);
    vi.spyOn(Math, 'random').mockImplementation(random);

    const result = generateAdvancedContent({
      ...BASE_PARAMS,
      platform: 'tiktok',
      selectedHashtags: HASHTAGS
    });

    expect(result.content).toMatch(/\n\.\n\.\n\./);
    expect(result.content).toContain('#');
  });
});
