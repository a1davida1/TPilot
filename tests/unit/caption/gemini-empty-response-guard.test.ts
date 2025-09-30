import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface MockResponse {
  response: { text: () => string | undefined };
}

const createMockResponse = (value: string | undefined): MockResponse => ({
  response: {
    text: () => value,
  },
});

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
  ])('throws in text-only variant generation when Gemini returns %s', async ({ value }) => {
    const textModel = { generateContent: vi.fn().mockResolvedValue(createMockResponse(value)) };

    vi.doMock('../../../server/lib/gemini.ts', () => ({
      __esModule: true,
      textModel,
      isGeminiAvailable: () => true,
    }));

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');

    await expect(
      generateVariantsTextOnly({
        platform: 'instagram',
        voice: 'persona_voice',
        theme: 'test theme',
        context: 'context',
        nsfw: false,
      })
    ).rejects.toThrow('Gemini: empty response');

    expect(textModel.generateContent).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'an empty string', value: '' },
    { label: 'undefined', value: undefined },
  ])('falls back to OpenAI when image pipeline receives %s', async ({ value }) => {
    const textModel = { generateContent: vi.fn().mockResolvedValue(createMockResponse(value)) };
    const visionPayload = JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' });
    const visionModel = { generateContent: vi.fn().mockResolvedValue(createMockResponse(visionPayload)) };

    const fallbackFinal = {
      caption: 'OpenAI fallback caption',
      alt: 'Detailed fallback alt text that satisfies schema.',
      hashtags: ['#fallback', '#test'],
      cta: 'Fallback CTA',
      mood: 'confident',
      style: 'authentic',
      safety_level: 'normal',
      nsfw: false,
    };
    const openAICaptionFallback = vi.fn().mockResolvedValue(fallbackFinal);

    vi.doMock('../../../server/lib/gemini.ts', () => ({
      __esModule: true,
      textModel,
      visionModel,
      isGeminiAvailable: () => true,
    }));
    vi.doMock('../../../server/caption/openaiFallback.ts', () => ({ openAICaptionFallback }));

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

    expect(openAICaptionFallback).toHaveBeenCalledTimes(1);
    expect(textModel.generateContent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('openai');
    expect(result.final.caption).toBe(fallbackFinal.caption);
    expect(result.final.alt).toBe(fallbackFinal.alt);
    expect(result.final.hashtags).toEqual(fallbackFinal.hashtags);
    expect(result.titles).toBeDefined();
    expect(result.titles?.length).toBeGreaterThan(0);

    fetchMock.mockRestore();
  });
});
