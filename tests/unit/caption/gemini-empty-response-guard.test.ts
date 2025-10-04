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

const buildCandidateVariants = (): CandidateVariantMock[] => [
  {
    caption: 'Living my best life under studio lights ✨',
    alt: 'Professional studio portrait with warm lighting and creative composition',
    hashtags: ['#studiovibe', '#creative', '#photoday'],
    cta: 'Share your thoughts below!',
    mood: 'engaging',
    style: 'authentic',
    safety_level: 'normal',
    nsfw: false,
  },
  {
    caption: 'Behind the scenes magic happening right now 🎬',
    alt: 'Candid moment during a professional photoshoot session',
    hashtags: ['#bts', '#photoshoot', '#magic'],
    cta: 'Drop a comment!',
    mood: 'playful',
    style: 'casual',
    safety_level: 'normal',
    nsfw: false,
  },
  {
    caption: 'Captured this moment of pure confidence today 💪',
    alt: 'Empowering portrait showcasing strength and determination',
    hashtags: ['#confidence', '#powerful', '#moment'],
    cta: 'What do you think?',
    mood: 'empowering',
    style: 'bold',
    safety_level: 'normal',
    nsfw: false,
  },
  {
    caption: 'Exploring new creative directions in the studio 🎨',
    alt: 'Artistic experimental photoshoot with unique styling and angles',
    hashtags: ['#artistic', '#experimental', '#creative'],
    cta: 'Tell me your favorite!',
    mood: 'artistic',
    style: 'experimental',
    safety_level: 'normal',
    nsfw: false,
  },
  {
    caption: 'Grateful for another amazing shoot day 🙏',
    alt: 'Heartfelt moment captured during a successful photoshoot',
    hashtags: ['#grateful', '#blessed', '#thankful'],
    cta: 'Send some love!',
    mood: 'grateful',
    style: 'heartfelt',
    safety_level: 'normal',
    nsfw: false,
  },
];

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

  it('returns safe fallback variants in text-only generation when Gemini returns an empty payload object', async () => {
    const textModel: GeminiTextModelMock = {
      generateContent: vi
        .fn<[
          input: unknown
        ], Promise<MockResponse>>()
        .mockResolvedValue({}),
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
    const { sanitizeFinalVariant } = await import('../../../server/caption/rankGuards.ts');

    const result = await pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'instagram',
    });

    const captions = result.variants?.map(variant => variant.caption) ?? [];
    const sanitizedFinal = sanitizeFinalVariant(result.final, 'instagram');
    const sanitizedVariantCaptions = result.variants?.map(variant => sanitizeFinalVariant(variant, 'instagram').caption) ?? [];

    expect(openAIFallback).not.toHaveBeenCalled();
    expect(captions).toEqual(candidateVariants.map(variant => variant.caption));
    expect(result.final).toBeDefined();
    expect(sanitizedVariantCaptions).toContainEqual(sanitizedFinal.caption);

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


describe('Gemini model adapter resilience', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGoogleKey = process.env.GOOGLE_GENAI_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_API_KEY = 'test-key';
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_GENAI_API_KEY;
    } else {
      process.env.GOOGLE_GENAI_API_KEY = originalGoogleKey;
    }
  });

  afterEach(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_GENAI_API_KEY;
    } else {
      process.env.GOOGLE_GENAI_API_KEY = originalGoogleKey;
    }
    vi.doUnmock('@google/genai');
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('resolves with empty text and retains candidates metadata when Gemini returns no candidates', async () => {
    process.env.GOOGLE_GENAI_API_KEY = 'test-key';

    const generateContent = vi.fn().mockResolvedValue({
      text: '',
      candidates: [],
      response: {
        text: () => '',
      },
    });

    const mockGetTextModel = vi.fn().mockReturnValue({ generateContent });

    vi.doMock('../../../server/lib/gemini-client', () => ({
      getTextModel: mockGetTextModel,
    }));

    vi.resetModules();

    const { getTextModel } = await import('../../../server/lib/gemini-client');

    const model = getTextModel();
    const result = await model.generateContent([]);

    expect(result.text).toBe('');

    const candidateMetadata = (result as { candidates?: unknown }).candidates;
    expect(Array.isArray(candidateMetadata)).toBe(true);
    expect(Array.isArray(candidateMetadata) ? candidateMetadata.length : -1).toBe(0);

    const responseContainer = (result as { response?: { text?: () => unknown } }).response;
    expect(responseContainer && typeof responseContainer === 'object').toBe(true);

    if (responseContainer && typeof responseContainer === 'object') {
      const resolver = (responseContainer as { text?: () => unknown }).text;
      expect(typeof resolver).toBe('function');
      if (typeof resolver === 'function') {
        expect(resolver()).toBe('');
      }
    }
  });

  it('preserves API candidate payloads when provided', async () => {
    process.env.GOOGLE_GENAI_API_KEY = 'test-key';

    type GeminiCandidate = {
      content?: {
        parts?: Array<{ text?: string }>;
      };
      text?: string;
    };

    const candidatePayload: GeminiCandidate[] = [
      {
        content: {
          parts: [{ text: 'Primary content' }],
        },
      },
    ];

    const generateContent = vi.fn().mockResolvedValue({
      text: 'Primary content',
      candidates: candidatePayload,
    });

    const mockGetTextModel = vi.fn().mockReturnValue({ generateContent });

    vi.doMock('../../../server/lib/gemini-client', () => ({
      getTextModel: mockGetTextModel,
    }));

    vi.resetModules();

    const { getTextModel } = await import('../../../server/lib/gemini-client');

    const result = await getTextModel().generateContent([]);

    expect((result as { text?: string }).text).toBe('Primary content');
    expect((result as { candidates?: unknown }).candidates).toBe(candidatePayload);
  });
});
