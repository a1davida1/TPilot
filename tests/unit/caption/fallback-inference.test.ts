import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

const createGeminiResponse = (payload: unknown) => {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    text,
    response: { text: () => text },
  };
};

type GeminiMockResponse = ReturnType<typeof createGeminiResponse>;

const mockTextModel = {
  generateContent: vi.fn<(input: unknown) => Promise<GeminiMockResponse>>(),
};

const mockVisionModel = {
  generateContent: vi.fn<(input: unknown) => Promise<GeminiMockResponse>>(),
};

const mockIsGeminiAvailable = vi.fn(() => true);

vi.mock('../../../server/lib/gemini-client', () => ({
  __esModule: true,
  getTextModel: () => mockTextModel,
  getVisionModel: () => mockVisionModel,
  isGeminiAvailable: mockIsGeminiAvailable,
}));

vi.mock('../../../server/lib/gemini.ts', () => ({
  __esModule: true,
  textModel: mockTextModel,
  visionModel: mockVisionModel,
  isGeminiAvailable: mockIsGeminiAvailable,
  getTextModel: () => mockTextModel,
  getVisionModel: () => mockVisionModel,
}));

describe('inferFallbackFromFacts helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTextModel.generateContent.mockReset();
    mockVisionModel.generateContent.mockReset();
    mockIsGeminiAvailable.mockReset();
    mockIsGeminiAvailable.mockReturnValue(true);
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockTextModel.generateContent.mockReset();
    mockVisionModel.generateContent.mockReset();
    mockIsGeminiAvailable.mockReset();
    mockIsGeminiAvailable.mockReturnValue(true);
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

    mockTextModel.generateContent.mockResolvedValueOnce(
      createGeminiResponse(variantPayload)
    );

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

    mockTextModel.generateContent.mockResolvedValueOnce(
      createGeminiResponse(variantPayload)
    );

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

  it('pads fallback variants without extending alt text beyond schema limits', async () => {
    const maxAlt = 'A'.repeat(200);
    const minimalVariantPayload = [
      {
        caption: 'Single strong option',
        hashtags: ['#focus'],
        safety_level: 'normal',
        mood: 'confident',
        style: 'modern',
        cta: 'Explore more now',
        alt: maxAlt,
        nsfw: false,
      },
    ];

    mockTextModel.generateContent.mockResolvedValue(
      createGeminiResponse(minimalVariantPayload)
    );

    const { generateVariants: generateGeminiVariants } = await import('../../../server/caption/geminiPipeline.ts');
    const geminiVariants = await generateGeminiVariants({
      platform: 'instagram',
      voice: 'bold',
      facts: { setting: 'studio set' },
      nsfw: false,
    });

    expect(geminiVariants).toHaveLength(5);
    geminiVariants.forEach(variant => {
      expect(variant.alt.length).toBeLessThanOrEqual(200);
      expect(variant.alt.toLowerCase().includes('retry filler')).toBe(false);
    });

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');
    const textOnlyVariants = await generateVariantsTextOnly({
      platform: 'instagram',
      voice: 'confident',
      theme: 'Studio reveal',
      context: 'Launch day',
      nsfw: false,
    });

    expect(textOnlyVariants).toHaveLength(5);
    textOnlyVariants.forEach(variant => {
      expect(variant.alt.length).toBeLessThanOrEqual(200);
      expect(variant.alt.toLowerCase().includes('retry filler')).toBe(false);
    });
  });
});

describe('fact extraction resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTextModel.generateContent.mockReset();
    mockVisionModel.generateContent.mockReset();
    mockIsGeminiAvailable.mockReset();
    mockIsGeminiAvailable.mockReturnValue(true);
  });

  it('returns safe defaults when Gemini responds with plain text facts', async () => {
    mockVisionModel.generateContent.mockResolvedValueOnce(
      createGeminiResponse('A vivid sunset with silhouettes, described plainly without JSON structure.')
    );

    const { extractFacts } = await import('../../../server/caption/geminiPipeline.ts');

    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAnwB9ngHKZkAAAAASUVORK5CYII=';
    const facts = await extractFacts(`data:image/png;base64,${tinyPng}`);

    expect(facts).toEqual({
      categories: [],
      objects: [],
      keywords: [],
      summary: '',
    });
    expect(mockVisionModel.generateContent).toHaveBeenCalledTimes(1);
  });
});
