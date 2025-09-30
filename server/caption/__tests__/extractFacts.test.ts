import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateContent = vi.fn();

vi.mock('../../lib/gemini', () => ({
  visionModel: { generateContent: mockGenerateContent },
  textModel: null,
  isGeminiAvailable: vi.fn(() => true)
}));

const ONE_BY_ONE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+9P6rAAAAAElFTkSuQmCC';

describe('extractFacts', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('accepts minimal PNG data URIs without throwing InvalidImageError', async () => {
    const fakeFacts = { objects: ['pixel'] };
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(fakeFacts) }
    });

    const { extractFacts } = await import('../geminiPipeline');

    await expect(extractFacts(ONE_BY_ONE_PNG)).resolves.toEqual(fakeFacts);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0]?.[0];
    expect(Array.isArray(callArgs)).toBe(true);
    expect(callArgs?.[1]?.inlineData?.mimeType).toBe('image/png');
  });
});