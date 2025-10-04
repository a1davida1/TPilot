import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface MockResponse {
  text?: string | (() => string | undefined);
  response?: unknown;
  candidates?: unknown;
}

const createMockResponse = (value: string | undefined): MockResponse => ({
  text: value,
  response: {
    text: () => value,
  },
});

interface CandidateVariantMock {
  caption: string;
  alt: string;
  hashtags: string[];
  cta: string;
  mood: string;
  style: string;
  safety_level: string;
  nsfw: boolean;
}

const buildCandidateVariants = (): CandidateVariantMock[] =>
  Array.from({ length: 5 }, (_, index) => ({
    caption: `Candidate caption ${index + 1} delivering value ${index}`,
    alt: `Detailed alternate description for candidate ${index + 1} covering the scene with engaging language and clarity.`,
    hashtags: ['#unique', '#crafted', `#story${index + 1}`],
    cta: 'Share your thoughts below!',
    mood: 'engaging',
    style: 'authentic',
    safety_level: 'normal',
    nsfw: false,
  }));

const createCandidateResponse = (variants: CandidateVariantMock[]): MockResponse => ({
  candidates: [
    {
      content: {
        parts: [
          { text: JSON.stringify(variants) },
        ],
      },
    },
  ],
});

type GenerateContentMock = ReturnType<typeof vi.fn<[
  input: unknown
], Promise<MockResponse>>>;

type GeminiTextModelMock = { generateContent: GenerateContentMock };
type GeminiVisionModelMock = { generateContent: GenerateContentMock };

const mockGemini = (
  textModel: GeminiTextModelMock,
  visionModel?: GeminiVisionModelMock,
) => {
  const resolvedVision = visionModel ?? { generateContent: vi.fn<[
    input: unknown
  ], Promise<MockResponse>>() };

  vi.doMock('../../../server/lib/gemini-client', () => ({
    __esModule: true,
    getTextModel: () => textModel,
    getVisionModel: () => resolvedVision,
    isGeminiAvailable: () => true,
  }));
  vi.doMock('../../../server/lib/gemini.ts', () => ({
    __esModule: true,
    getTextModel: () => textModel,
    getVisionModel: () => resolvedVision,
    isGeminiAvailable: () => true,
  }));
};

const streamFromChunks = (chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
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

  it.each<[{ label: string; value: string | undefined }]>([
    [{ label: 'an empty string', value: '' }],
    [{ label: 'undefined', value: undefined }],
  ])('returns safe fallback variants in text-only generation when Gemini returns %s', async ({ value }) => {
    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(value)),
    };

    mockGemini(textModel);

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');

    const variants = await generateVariantsTextOnly({
      platform: 'instagram',
      voice: 'persona_voice',
      theme: 'test theme',
      context: 'context',
      nsfw: false,
    });

    expect(textModel.generateContent).toHaveBeenCalled();
    expect(variants).toHaveLength(5);
    variants.forEach(variant => {
      expect(typeof variant.caption).toBe('string');
      expect(variant.caption.length).toBeGreaterThan(0);
    });
  });

  it.each<[{ label: string; value: string | undefined }]>([
    [{ label: 'an empty string', value: '' }],
    [{ label: 'undefined', value: undefined }],
  ])('returns safe Gemini fallbacks when image pipeline receives %s', async ({ value }) => {
    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(value)),
    };
    const visionPayload = JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' });
    const visionModel: GeminiVisionModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(visionPayload)),
    };

    mockGemini(textModel, visionModel);

    vi.doMock('../../../server/caption/openaiFallback.ts', () => ({
      openAICaptionFallback: vi.fn(),
    }));

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const chunk = new Uint8Array(64).fill(1);
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': `${chunk.byteLength}` }),
      body: streamFromChunks([chunk]),
    } as unknown as Response);

    const { pipeline } = await import('../../../server/caption/geminiPipeline.ts');

    const result = await pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'instagram',
    });

    expect(textModel.generateContent).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('gemini');
    expect(result.final.caption).toBeTruthy();
    expect(result.final.alt).toBeTruthy();
    expect(Array.isArray(result.final.hashtags)).toBe(true);
    expect(result.titles?.length).toBeGreaterThan(0);

    fetchMock.mockRestore();
  });

  it('returns Gemini variants when candidate payload is provided in text-only pipeline', async () => {
    const candidateVariants = buildCandidateVariants();
    const candidateResponse = createCandidateResponse(candidateVariants);

    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(candidateResponse),
    };

    mockGemini(textModel);

    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');

    const variants = await generateVariantsTextOnly({
      platform: 'instagram',
      voice: 'persona_voice',
      theme: 'test theme',
      context: 'context',
      nsfw: false,
    });

    const captions = variants.map(variant => variant.caption);

    expect(captions).toEqual(candidateVariants.map(variant => variant.caption));
    expect(captions.some(caption => caption.includes('fallback'))).toBe(false);
  });

  it('uses Gemini candidate payload during multimodal pipeline generation', async () => {
    const candidateVariants = buildCandidateVariants();
    const candidateResponse = createCandidateResponse(candidateVariants);

    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(candidateResponse),
    };
    const visionPayload = JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' });
    const visionModel: GeminiVisionModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse(visionPayload)),
    };

    mockGemini(textModel, visionModel);

    const openAIFallback = vi.fn();
    vi.doMock('../../../server/caption/openaiFallback.ts', () => ({
      openAICaptionFallback: openAIFallback,
    }));

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const chunk = new Uint8Array(64).fill(1);
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': `${chunk.byteLength}` }),
      body: streamFromChunks([chunk]),
    } as unknown as Response);

    const { pipeline } = await import('../../../server/caption/geminiPipeline.ts');

    const result = await pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'instagram',
    });

    const captions = result.variants?.map(variant => variant.caption) ?? [];

    expect(openAIFallback).not.toHaveBeenCalled();
    expect(captions).toEqual(candidateVariants.map(variant => variant.caption));
    expect(captions).toContain(result.final.caption);

    fetchMock.mockRestore();
  });

  it('throws InvalidImageError when the remote image exceeds the configured size limit', async () => {
    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse('fallback response')),
    };
    const visionModel: GeminiVisionModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue(createMockResponse('{"objects": ["item"]}')),
    };

    mockGemini(textModel, visionModel);

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-type': 'image/jpeg',
        'content-length': `${6 * 1024 * 1024}`,
      }),
      body: streamFromChunks([new Uint8Array(1)]),
    } as unknown as Response);

    const { extractFacts, InvalidImageError } = await import('../../../server/caption/geminiPipeline.ts');

    await expect(extractFacts('https://example.com/oversized.jpg')).rejects.toBeInstanceOf(InvalidImageError);
    expect(visionModel.generateContent).not.toHaveBeenCalled();

    fetchMock.mockRestore();
  });
});
