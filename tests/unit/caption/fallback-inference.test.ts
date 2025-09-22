import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../server/lib/gemini.js', () => ({
  textModel: {
    generateContent: vi.fn(),
  },
  visionModel: {
    generateContent: vi.fn(),
  },
}));

describe('inferFallbackFromFacts helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('infers beach-centric fallbacks from image facts', async () => {
    const { inferFallbackFromFacts } = await import('../../../server/caption/inferFallbackFromFacts.js');
    const fallback = inferFallbackFromFacts({
      platform: 'instagram',
      facts: {
        objects: ['surfer', 'board'],
        setting: 'sunny beach cove',
        colors: ['turquoise water'],
      },
    });

    expect(fallback.hashtags.some(tag => tag.includes('beach') || tag.includes('surfer') || tag.includes('board'))).toBe(true);
    expect(fallback.cta.toLowerCase()).toMatch(/beach|surfer|board|turquoise|water/);
    expect(fallback.alt.toLowerCase()).toMatch(/beach|surfer|board|turquoise|water|scene/);
  });

  it('adapts fallback data for text-only launch themes', async () => {
    const { inferFallbackFromFacts } = await import('../../../server/caption/inferFallbackFromFacts.js');
    const fallback = inferFallbackFromFacts({
      platform: 'x',
      theme: 'Fintech product launch',
      context: 'Beta waitlist opens tonight',
    });

    expect(fallback.hashtags.length).toBeLessThanOrEqual(3);
    expect(fallback.hashtags.some(tag => tag.includes('launch') || tag.includes('product') || tag.includes('fintech'))).toBe(true);
    expect(fallback.cta.toLowerCase()).toMatch(/launch|product|fintech|conversation|join/);
  });
});

describe('pipeline fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills missing variant fields with contextual beach data', async () => {
    const { textModel } = await import('../../../server/lib/gemini.js');
    (textModel.generateContent as unknown as Mock).mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify([
            {
              caption: 'Sunset set vibes',
              hashtags: [],
              safety_level: 'normal',
              mood: '',
              style: '',
              cta: '',
              alt: '',
              nsfw: false,
            },
          ]),
      },
    });

    const { generateVariants } = await import('../../../server/caption/geminiPipeline.js');
    const variants = await generateVariants({
      platform: 'instagram',
      voice: 'bold',
      facts: {
        setting: 'sunny beach cove',
        objects: ['surfer', 'board'],
      },
      nsfw: false,
    });

    const first = variants[0];
    expect(first.hashtags.some(tag => tag.includes('beach') || tag.includes('surfer') || tag.includes('board'))).toBe(true);
    expect(first.cta.toLowerCase()).toMatch(/beach|surfer|board|objects|explore/);
    expect(first.alt.toLowerCase()).toMatch(/beach|surfer|board|scene|featuring|objects/);
  });

  it('crafts launch-oriented fallbacks for text-only prompts', async () => {
    const { textModel } = await import('../../../server/lib/gemini.js');
    (textModel.generateContent as unknown as Mock).mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify([
            {
              caption: 'Join us for something big',
              hashtags: [],
              safety_level: 'normal',
              mood: '',
              style: '',
              cta: '',
              alt: '',
              nsfw: false,
            },
          ]),
      },
    });

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.js');
    const variants = await generateVariantsTextOnly({
      platform: 'x',
      voice: 'confident',
      theme: 'SaaS platform launch',
      context: 'Waitlist opens this Friday',
      nsfw: false,
    });

    const first = variants[0];
    expect(first.hashtags.some(tag => tag.includes('launch') || tag.includes('saas') || tag.includes('platform'))).toBe(true);
    expect(first.cta.toLowerCase()).toMatch(/launch|saas|platform|conversation|join/);
    expect(first.alt.toLowerCase()).toMatch(/launch|saas|platform|representation|visual/);
  });
});