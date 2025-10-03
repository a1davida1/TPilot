
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildVoiceGuideBlock } from '../../../server/caption/stylePack';
import { formatVoiceContext } from '../../../server/caption/voiceTraits';
import { generateVariants } from '../../../server/caption/geminiPipeline';
import { generateVariantsTextOnly } from '../../../server/caption/textOnlyPipeline';
import { variantsRewrite } from '../../../server/caption/rewritePipeline';

const mockTextModel = vi.hoisted(() => ({
  generateContent: vi.fn<(input: unknown) => Promise<{ text: string; response: { text: () => string } }>>()
}));

const mockVisionModel = vi.hoisted(() => ({
  generateContent: vi.fn<(input: unknown) => Promise<{ text: string; response: { text: () => string } }>>()
}));

const mockIsGeminiAvailable = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../../server/lib/gemini.ts', () => ({
  __esModule: true,
  textModel: mockTextModel,
  visionModel: mockVisionModel,
  getTextModel: () => mockTextModel,
  getVisionModel: () => mockVisionModel,
  isGeminiAvailable: mockIsGeminiAvailable,
}));

type CaptionVariant = {
  caption: string;
  alt: string;
  hashtags: string[];
  cta: string;
  mood: string;
  style: string;
  safety_level: string;
  nsfw: boolean;
};

function makeVariants(): CaptionVariant[] {
  return Array.from({ length: 5 }, (_, index) => ({
    caption: `Caption ${index} that is lively and descriptive`,
    alt: `Detailed alternative text ${index} describing the scene with plenty of texture.`,
    hashtags: ['#tag1', '#tag2', '#tag3'],
    cta: 'Learn more',
    mood: 'joyful',
    style: 'vibrant',
    safety_level: 'normal',
    nsfw: false,
  }));
}

interface PromptPayload {
  text: string;
}

function isPromptPayload(value: unknown): value is PromptPayload {
  return typeof value === 'object' && value !== null && 'text' in value && typeof (value as { text: unknown }).text === 'string';
}

const createGeminiResponse = (payload: string) => ({
  text: payload,
  response: { text: () => payload },
});

function collectPromptTexts(): string[] {
  return mockTextModel.generateContent.mock.calls
    .map(([args]) => (Array.isArray(args) ? args[0] : undefined))
    .filter((payload): payload is PromptPayload => isPromptPayload(payload))
    .map(payload => payload.text);
}

describe('Voice guide prompt forwarding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockTextModel.generateContent.mockReset();
    mockVisionModel.generateContent.mockReset();
    mockIsGeminiAvailable.mockReset();
    mockIsGeminiAvailable.mockReturnValue(true);
    const clientMock = () => ({
      __esModule: true,
      getTextModel: () => mockTextModel,
      getVisionModel: () => mockVisionModel,
      isGeminiAvailable: mockIsGeminiAvailable,
    });
    vi.doMock('../../../server/lib/gemini-client', clientMock);
    vi.doMock('../../../server/lib/gemini-client.ts', clientMock);
    const legacyMock = () => ({
      __esModule: true,
      textModel: mockTextModel,
      visionModel: mockVisionModel,
      isGeminiAvailable: mockIsGeminiAvailable,
      getTextModel: () => mockTextModel,
      getVisionModel: () => mockVisionModel,
    });
    vi.doMock('../../../server/lib/gemini', legacyMock);
    vi.doMock('../../../server/lib/gemini.ts', legacyMock);
  });

  it('includes the voice guide when generating image-based variants', async () => {
    const { generateVariants } = await import('../../../server/caption/geminiPipeline.ts');
    
    const variants = makeVariants();
    mockVisionModel.generateContent.mockResolvedValue(
      createGeminiResponse(JSON.stringify({ objects: ['sunset'] }))
    );
    mockTextModel.generateContent.mockResolvedValue(
      createGeminiResponse(JSON.stringify(variants))
    );
    const { getTextModel } = await import('../../../server/lib/gemini-client.ts');
    expect(getTextModel()).toBe(mockTextModel);

    await generateVariants({
      platform: 'instagram',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      facts: { objects: ['sunset'] },
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalled();
    const promptTexts = collectPromptTexts();
    expect(promptTexts.length).toBeGreaterThan(0);
    
    const voiceContext = formatVoiceContext('flirty_playful');
    expect(voiceContext).not.toHaveLength(0);
    expect(promptTexts.some(text => text.includes('flirty_playful'))).toBe(true);
    expect(promptTexts.some(text => text.includes('bold'))).toBe(true);
    expect(promptTexts.some(text => text.includes('playful'))).toBe(true);
  });

  it('includes the voice guide for text-only variant generation', async () => {
    const { generateVariantsTextOnly } = await import('../../../server/caption/textOnlyPipeline.ts');
    mockTextModel.generateContent.mockResolvedValueOnce(
      createGeminiResponse(JSON.stringify(makeVariants()))
    );
    const { getTextModel } = await import('../../../server/lib/gemini-client.ts');
    expect(getTextModel()).toBe(mockTextModel);

    await generateVariantsTextOnly({
      platform: 'x',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      theme: 'Sunset gaming session',
      context: 'Highlight the vibrant sky and friendly banter',
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalled();
    const promptTexts = collectPromptTexts();
    expect(promptTexts.length).toBeGreaterThan(0);
    
    const voiceContext = formatVoiceContext('flirty_playful');
    expect(voiceContext).not.toHaveLength(0);
    expect(promptTexts.some(text => text.includes('flirty_playful'))).toBe(true);
    expect(promptTexts.some(text => text.includes('bold'))).toBe(true);
    expect(promptTexts.some(text => text.includes('playful'))).toBe(true);
  });

  it('includes the voice guide when rewriting captions', async () => {
    const { variantsRewrite } = await import('../../../server/caption/rewritePipeline.ts');
    mockTextModel.generateContent.mockResolvedValueOnce(
      createGeminiResponse(JSON.stringify(makeVariants()))
    );
    const { getTextModel } = await import('../../../server/lib/gemini-client.ts');
    expect(getTextModel()).toBe(mockTextModel);

    await variantsRewrite({
      platform: 'reddit',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      existingCaption: 'Original caption that needs polish',
      facts: { setting: 'beach at dusk' },
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalled();
    const promptTexts = collectPromptTexts();
    expect(promptTexts.length).toBeGreaterThan(0);
    const guide = buildVoiceGuideBlock('flirty_playful');
    if (!guide) throw new Error('Voice guide missing for flirty_playful');
    expect(promptTexts.some(text => text.includes(guide))).toBe(true);
  });
});
