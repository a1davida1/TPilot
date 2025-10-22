import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { GeminiGenerateContentInput } from '../../../../server/lib/gemini-client';

const {
  geminiModel,
  geminiClient,
  googleGenerativeAIConstructor
} = vi.hoisted(() => {
  const geminiModel = {
    generateContent: vi.fn()
  };
  const geminiClient = {
    models: {
      generateContent: vi.fn()
    }
  };
  const googleGenerativeAIConstructor = vi.fn(() => ({
    getGenerativeModel: vi.fn().mockReturnValue(geminiModel)
  }));

  return { geminiModel, geminiClient, googleGenerativeAIConstructor };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: googleGenerativeAIConstructor
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => geminiClient)
}));

let originalGeminiKey: string | undefined;

describe('Gemini client model adapter', () => {
  beforeEach(() => {
    originalGeminiKey = process.env.GOOGLE_GENAI_API_KEY;
    vi.clearAllMocks();
    geminiModel.generateContent.mockReset();
    geminiClient.models.generateContent.mockReset();
    googleGenerativeAIConstructor.mockReset();
    process.env.GOOGLE_GENAI_API_KEY = 'unit-test-gemini-key';
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    if (typeof originalGeminiKey === 'string') {
      process.env.GOOGLE_GENAI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GOOGLE_GENAI_API_KEY;
    }
  });

  it('flattens candidate content parts into the text helpers', async () => {
    const nestedResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'First' }, { text: ' second' }]
          }
        },
        {
          content: {
            parts: [{ text: ' third' }]
          }
        }
      ],
      usageMetadata: { totalTokenCount: 42 }
    };

    // Mock the client.models.generateContent method
    geminiClient.models.generateContent.mockResolvedValueOnce(nestedResponse);

    const { getTextModel } = await import('../../../../server/lib/gemini-client.ts');
    const textModel = getTextModel();
    const prompt: GeminiGenerateContentInput = [
      {
        role: 'user',
        parts: [{ text: 'Prompt' }]
      }
    ];

    const result = await textModel.generateContent(prompt);

    expect(result.text).toBe('First second third');
    expect(result.response?.text?.()).toBe('First second third');
    expect(result.candidates).toBe(nestedResponse.candidates);
    expect(result.usageMetadata).toEqual({ totalTokenCount: 42 });
  });
});
