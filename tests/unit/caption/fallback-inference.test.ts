import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../server/lib/gemini.ts', () => ({
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
    const { inferFallbackFromFacts } = await import('../../../server/caption/inferFallbackFromFacts.ts');
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
    const { inferFallbackFromFacts } = await import('../../../server/caption/inferFallbackFromFacts.ts');
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
  beforeEach(async () => {
    vi.clearAllMocks();
    const { textModel, visionModel } = await import('../../../server/lib/gemini.ts');
    (textModel.generateContent as unknown as Mock)?.mockReset?.();
    (visionModel.generateContent as unknown as Mock)?.mockReset?.();
  });

  it('fills missing variant fields with contextual beach data', async () => {
    const variantPayload = [
      {
        caption: 'Sunset set vibes',
        hashtags: ['#beach', '#surfer', '#sunset'],
        safety_level: 'normal',
        mood: 'relaxed',
        style: 'beach',
        cta: 'Explore beach adventures',
        alt: 'Beach scene featuring surfer and board',
        nsfw: false,
      },
      {
        caption: 'Beach day energy with golden light',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'Catching waves under perfect sky',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'Surfboard ready for the next set',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'Ocean breeze and endless possibilities',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
    ];

    const { textModel } = await import('../../../server/lib/gemini.ts');
    (textModel.generateContent as unknown as Mock).mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(variantPayload),
      },
    });

    const { generateVariants } = await import('../../../server/caption/geminiPipeline.ts');
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
    const variantPayload = [
      {
        caption: 'Join us for something big',
        hashtags: ['#launch', '#saas', '#platform'],
        safety_level: 'normal',
        mood: 'excited',
        style: 'professional',
        cta: 'Join the launch conversation',
        alt: 'Launch platform representation',
        nsfw: false,
      },
      {
        caption: 'Friday launch excitement builds up',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'SaaS platform ready to transform workflows',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'Waitlist opens with exclusive early access',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
      {
        caption: 'Revolutionary tools coming this week',
        hashtags: [],
        safety_level: 'normal',
        mood: '',
        style: '',
        cta: '',
        alt: '',
        nsfw: false,
      },
    ];

    const { textModel } = await import('../../../server/lib/gemini.ts');
    (textModel.generateContent as unknown as Mock).mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify(variantPayload),
      },
    });

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');
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