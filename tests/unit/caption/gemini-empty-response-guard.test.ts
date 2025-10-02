import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface MockResponse {
  text: string | undefined;
  response: { text: () => string | undefined };
}

const createMockResponse = (value: string | undefined): MockResponse => ({
  text: value,
  response: {
    text: () => value,
  },
});

const mockGemini = (
  textModel: { generateContent: ReturnType<typeof vi.fn<(input: unknown) => Promise<MockResponse>>> },
  visionModel?: { generateContent: ReturnType<typeof vi.fn<(input: unknown) => Promise<MockResponse>>> }
) => {
  const resolvedVision = visionModel ?? { generateContent: vi.fn<(input: unknown) => Promise<MockResponse>>() };
  vi.doMock('../../../server/lib/gemini-client', () => ({
    __esModule: true,
    getTextModel: () => textModel,
    getVisionModel: () => resolvedVision,
    isGeminiAvailable: () => true,
  }));
  vi.doMock('../../../server/lib/gemini.ts', () => ({
    __esModule: true,
    textModel,
    visionModel: resolvedVision,
    isGeminiAvailable: () => true,
    getTextModel: () => textModel,
    getVisionModel: () => resolvedVision,
  }));
};

describe('Gemini empty response guards', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it.each([
    { label: 'an empty string', value: '' },
    { label: 'undefined', value: undefined },
<<<<<<< ours
  ])('returns safe fallback variants in text-only generation when Gemini returns %s', async ({ value }) => {
    const textModel = {
      generateContent: vi
        .fn<(input: unknown) => Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(value)),
    };

    mockGemini(textModel);

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');

    const result = await generateVariantsTextOnly({
=======
  ])('returns safe fallbacks in text-only generation when Gemini returns %s', async ({ value }) => {
    const textModel = { generateContent: vi.fn().mockResolvedValue(createMockResponse(value)) };

    vi.doMock('../../../server/lib/gemini.ts', () => ({
      __esModule: true,
      textModel,
      getTextModel: () => textModel,
      isGeminiAvailable: () => true,
    }));

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');

    const variants = await generateVariantsTextOnly({
>>>>>>> theirs
      platform: 'instagram',
      voice: 'persona_voice',
      theme: 'test theme',
      context: 'context',
      nsfw: false,
    });

    expect(textModel.generateContent).toHaveBeenCalled();
<<<<<<< ours
    expect(result).toHaveLength(5);
    expect(result.every(variant => typeof variant.caption === 'string' && variant.caption.length > 0)).toBe(true);
    expect(result[0]?.caption).toContain("Here's something I'm proud of today.");
=======
    expect(variants).toHaveLength(5);
    variants.forEach((variant) => {
      expect(variant.caption).toContain('(fallback');
      expect(variant.alt).toContain('(fallback');
    });
>>>>>>> theirs
  });

  it.each([
    { label: 'an empty string', value: '' },
    { label: 'undefined', value: undefined },
<<<<<<< ours
  ])('returns Gemini-safe variants when image pipeline receives %s', async ({ value }) => {
    const textModel = {
      generateContent: vi
        .fn<(input: unknown) => Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(value)),
    };
=======
  ])('returns safe Gemini fallbacks when image pipeline receives %s', async ({ value }) => {
    const textModel = { generateContent: vi.fn().mockResolvedValue(createMockResponse(value)) };
>>>>>>> theirs
    const visionPayload = JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' });
    const visionModel = {
      generateContent: vi
        .fn<(input: unknown) => Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(visionPayload)),
    };

<<<<<<< ours
    mockGemini(textModel, visionModel);
    vi.doMock('../../../server/caption/openaiFallback.ts', () => ({ openAICaptionFallback: vi.fn() }));
=======
    vi.doMock('../../../server/lib/gemini.ts', () => ({
      __esModule: true,
      textModel,
      visionModel,
      getTextModel: () => textModel,
      getVisionModel: () => visionModel,
      isGeminiAvailable: () => true,
    }));
    vi.doMock('../../../server/caption/openaiFallback.ts', () => ({ openAICaptionFallback }));
>>>>>>> theirs

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new Uint8Array(64).fill(1).buffer,
    } as unknown as Response);

    const { pipeline } = await import('../../../server/caption/geminiPipeline.ts');

    const result = await pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'instagram',
    });

<<<<<<< ours
    expect(textModel.generateContent).toHaveBeenCalledTimes(1);
    expect(result.final).toBeDefined();
    expect(result.final.caption).toBeTruthy();
    expect(result.final.alt).toBeTruthy();
    expect(result.final.hashtags).toBeDefined();
=======
    expect(openAICaptionFallback).not.toHaveBeenCalled();
    expect(textModel.generateContent).toHaveBeenCalled();
    expect(result.provider).toBe('gemini');
    expect(result.final.caption).toContain('fallback');
    expect(result.final.alt).toContain('fallback');
    expect(Array.isArray(result.final.hashtags)).toBe(true);
>>>>>>> theirs
    expect(result.titles).toBeDefined();
    expect(result.titles?.length).toBeGreaterThan(0);

    fetchMock.mockRestore();
  });
});
