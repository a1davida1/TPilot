import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiModel } from '../lib/gemini';

const mockVisionModel = vi.hoisted(() => ({
  generateContent: vi.fn<
    Parameters<GeminiModel['generateContent']>,
    ReturnType<GeminiModel['generateContent']>
  >()
} satisfies GeminiModel));

vi.mock('../lib/gemini', () => ({
  visionModel: mockVisionModel,
  textModel: null,
  getVisionModel: () => mockVisionModel,
  getTextModel: () => null,
  isGeminiAvailable: vi.fn(() => true)
}));

const ONE_BY_ONE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+9P6rAAAAAElFTkSuQmCC';

describe('extractFacts', () => {
  beforeEach(() => {
    mockVisionModel.generateContent.mockReset();
  });

  it('accepts minimal PNG data URIs without throwing InvalidImageError', async () => {
    const fakeFacts = { objects: ['pixel'] };
    mockVisionModel.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(fakeFacts) }
    });

    const { extractFacts } = await import('../geminiPipeline');

    await expect(extractFacts(ONE_BY_ONE_PNG)).resolves.toEqual(fakeFacts);

    expect(mockVisionModel.generateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockVisionModel.generateContent.mock.calls[0]?.[0];
    expect(Array.isArray(callArgs)).toBe(true);
    expect(callArgs?.[1]?.inlineData?.mimeType).toBe('image/png');
  });
});