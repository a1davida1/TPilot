
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildVoiceGuideBlock } from '../../../server/caption/stylePack';
import { generateVariants } from '../../../server/caption/geminiPipeline';
import { generateVariantsTextOnly } from '../../../server/caption/textOnlyPipeline';
import { variantsRewrite } from '../../../server/caption/rewritePipeline';

const mockTextModel = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

const mockVisionModel = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('../../../../server/lib/gemini.ts', () => ({
  __esModule: true,
  textModel: mockTextModel,
  visionModel: mockVisionModel,
  isGeminiAvailable: () => true,
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

function extractPromptText(): string {
  const firstCall = mockTextModel.generateContent.mock.calls[0];
  if (!firstCall) {
    throw new Error('textModel.generateContent was not called');
  }
  const [firstArg] = firstCall;
  if (!Array.isArray(firstArg)) {
    throw new Error('Expected prompt argument array for textModel.generateContent');
  }
  const [payload] = firstArg;
  if (!isPromptPayload(payload)) {
    throw new Error('Prompt payload is missing expected text field');
  }
  return payload.text;
}

describe('Voice guide prompt forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTextModel.generateContent.mockReset();
    mockVisionModel.generateContent.mockReset();
  });

  it('includes the voice guide when generating image-based variants', async () => {
    mockTextModel.generateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(makeVariants()) },
    });

    await generateVariants({
      platform: 'instagram',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      facts: { objects: ['sunset'] },
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalledTimes(1);
    const promptText = extractPromptText();
    const guide = buildVoiceGuideBlock('flirty_playful');
    if (!guide) throw new Error('Voice guide missing for flirty_playful');
    expect(promptText).toContain(guide);
  });

  it('includes the voice guide for text-only variant generation', async () => {
    mockTextModel.generateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(makeVariants()) },
    });

    await generateVariantsTextOnly({
      platform: 'x',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      theme: 'Sunset gaming session',
      context: 'Highlight the vibrant sky and friendly banter',
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalledTimes(1);
    const promptText = extractPromptText();
    const guide = buildVoiceGuideBlock('flirty_playful');
    if (!guide) throw new Error('Voice guide missing for flirty_playful');
    expect(promptText).toContain(guide);
  });

  it('includes the voice guide when rewriting captions', async () => {
    mockTextModel.generateContent.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(makeVariants()) },
    });

    await variantsRewrite({
      platform: 'reddit',
      voice: 'flirty_playful',
      style: 'bold',
      mood: 'playful',
      existingCaption: 'Original caption that needs polish',
      facts: { setting: 'beach at dusk' },
      nsfw: false,
    });

    expect(mockTextModel.generateContent).toHaveBeenCalledTimes(1);
    const promptText = extractPromptText();
    const guide = buildVoiceGuideBlock('flirty_playful');
    if (!guide) throw new Error('Voice guide missing for flirty_playful');
    expect(promptText).toContain(guide);
  });
});
