
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

interface MockGeminiResponse {
  response: { text: () => string };
}

interface MockVariant {
  caption: string;
  alt: string;
  hashtags: string[];
  cta: string;
  mood: string;
  style: string;
  safety_level: string;
  nsfw: boolean;
}

const createTextModelMock = () => ({
  generateContent: vi.fn<
    [Array<{ text: string }>],
    Promise<MockGeminiResponse>
  >()
});

const createMockResponse = (payload: string): MockGeminiResponse => ({
  response: { text: () => payload }
});

const createVariantSet = (caption: string, hashtags: string[]) => {
  const base: MockVariant = {
    caption,
    alt: 'Detailed alt text describing the content for regression testing.',
    hashtags,
    cta: 'Check it out',
    mood: 'Upbeat',
    style: 'Bold Persona',
    safety_level: 'normal',
    nsfw: false
  };

  const variants = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    caption: `${caption} v${index}`
  }));

  return {
    variants,
    payload: JSON.stringify(variants)
  };
};

const createRankingPayload = (variant: MockVariant) => JSON.stringify({
  winner_index: 0,
  scores: [5, 4, 3, 2, 1],
  reason: 'Persona retention regression test',
  final: variant
});

const extractVariantPrompts = (calls: Array<[Array<{ text: string }>]>) => calls
  .map(call => call[0]?.[0]?.text ?? '')
  .filter(text => text.includes('PLATFORM:'));

describe('Gemini pipelines keep persona tone on retry', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('forwards tone fields on image pipeline retry', async () => {
    const textModel = createTextModelMock();
    const visionModel = { generateContent: vi.fn() };

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel, visionModel }));

    const fetchMock = vi.spyOn(global, 'fetch');
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: async () => Buffer.alloc(256, 1)
    } as unknown as Response);

    visionModel.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ objects: ['subject'], setting: 'studio', mood: 'focused' }) }
    });

    const geminiModule = await import('../../../server/caption/geminiPipeline.js');

    const failing = createVariantSet('First attempt caption exceeding X rules', ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Second attempt caption obeys X rules', ['#one', '#two']);

    textModel.generateContent
      .mockResolvedValueOnce(createMockResponse(failing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(failing.variants[0])))
      .mockResolvedValueOnce(createMockResponse(passing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(passing.variants[0])));

    await geminiModule.pipeline({
      imageUrl: 'https://example.com/image.png',
      platform: 'x',
      voice: 'Persona Voice',
      style: 'Bold Persona',
      mood: 'Upbeat',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');

    fetchMock.mockRestore();
  });

  it('forwards tone fields on rewrite pipeline retry', async () => {
    const textModel = createTextModelMock();
    const visionModel = { generateContent: vi.fn() };

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel, visionModel }));

    const rewriteModule = await import('../../../server/caption/rewritePipeline.js');

    const failing = createVariantSet('Rewrite attempt fails platform rules', ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Rewrite attempt passes platform rules', ['#one', '#two']);

    textModel.generateContent
      .mockResolvedValueOnce(createMockResponse(failing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(failing.variants[0])))
      .mockResolvedValueOnce(createMockResponse(passing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(passing.variants[0])));

    await rewriteModule.pipelineRewrite({
      platform: 'x',
      voice: 'Persona Voice',
      style: 'Bold Persona',
      mood: 'Upbeat',
      existingCaption: 'Original',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');
  });

  it('forwards tone fields on text-only pipeline retry', async () => {
    const textModel = createTextModelMock();

    vi.doMock('../../../server/lib/gemini.js', () => ({ textModel }));

    const textOnlyModule = await import('../../../server/caption/textOnlyPipeline.js');

    const failing = createVariantSet('Text-only attempt fails platform rules', ['#one', '#two', '#three', '#four']);
    const passing = createVariantSet('Text-only attempt passes platform rules', ['#one', '#two']);

    textModel.generateContent
      .mockResolvedValueOnce(createMockResponse(failing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(failing.variants[0])))
      .mockResolvedValueOnce(createMockResponse(passing.payload))
      .mockResolvedValueOnce(createMockResponse(createRankingPayload(passing.variants[0])));

    await textOnlyModule.pipelineTextOnly({
      platform: 'x',
      voice: 'Persona Voice',
      theme: 'Testing theme',
      context: 'Testing context',
      style: 'Bold Persona',
      mood: 'Upbeat',
      nsfw: false
    });

    const variantPrompts = extractVariantPrompts(textModel.generateContent.mock.calls);

    expect(variantPrompts).toHaveLength(2);
    const retryPrompt = variantPrompts[1];
    expect(retryPrompt).toContain('Fix:');
    expect(retryPrompt).toContain('STYLE: Bold Persona');
    expect(retryPrompt).toContain('MOOD: Upbeat');
  });
});
