import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVisionModel = vi.hoisted(() => ({
  generateContent: vi.fn()
}));

const getVisionModelMock = vi.hoisted(() => vi.fn(() => mockVisionModel));

vi.mock('../../lib/gemini-client', () => ({
  getVisionModel: getVisionModelMock,
  getTextModel: vi.fn(),
  isGeminiAvailable: vi.fn(() => true)
}));

const ONE_BY_ONE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+9P6rAAAAAElFTkSuQmCC';

describe('extractFacts', () => {
  beforeEach(() => {
    mockVisionModel.generateContent.mockReset();
    getVisionModelMock.mockClear();
    getVisionModelMock.mockReturnValue(mockVisionModel);
  });

  it('accepts minimal PNG data URIs without throwing InvalidImageError', async () => {
    const fakeFacts = { objects: ['pixel'] };
    mockVisionModel.generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(fakeFacts) }
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { extractFacts } = await import('../geminiPipeline');

    await expect(extractFacts(ONE_BY_ONE_PNG)).resolves.toEqual(fakeFacts);

    expect(getVisionModelMock).toHaveBeenCalledTimes(1);
    expect(mockVisionModel.generateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockVisionModel.generateContent.mock.calls[0]?.[0];
    expect(Array.isArray(callArgs)).toBe(true);
    expect(callArgs?.[1]?.inlineData?.mimeType).toBe('image/png');
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});