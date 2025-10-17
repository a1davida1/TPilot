
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  geminiModel,
  googleGenerativeAIConstructor
} = vi.hoisted(() => {
  const geminiModel = {
    generateContent: vi.fn()
  };
  const googleGenerativeAIConstructor = vi.fn(() => ({
    getGenerativeModel: vi.fn().mockReturnValue(geminiModel)
  }));

  return { geminiModel, googleGenerativeAIConstructor };
});

const mockAnthropic = vi.hoisted(() => ({
  messages: {
    create: vi.fn()
  }
}));

const mockOpenAI = vi.hoisted(() => ({
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}));

const mockSafeLog = vi.hoisted(() => vi.fn());

const openAIConstructor = vi.hoisted(() => vi.fn(() => mockOpenAI));
const anthropicConstructor = vi.hoisted(() => vi.fn(() => mockAnthropic));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: googleGenerativeAIConstructor
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: googleGenerativeAIConstructor
}));

vi.mock('openai', () => ({ default: openAIConstructor }));
vi.mock('@anthropic-ai/sdk', () => ({ default: anthropicConstructor }));
vi.mock('../../../../server/lib/logger-utils.ts', () => ({ safeLog: mockSafeLog }));

const envKeys = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENAI_API_KEY',
  'GEMINI_TEXT_MODEL',
  'GEMINI_VISION_MODEL',
  'OPENROUTER_API_KEY'
] as const;
type EnvKey = typeof envKeys[number];

const originalEnv: Record<EnvKey, string | undefined> = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
  GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL,
  GEMINI_VISION_MODEL: process.env.GEMINI_VISION_MODEL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
};

describe('generateWithMultiProvider provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geminiModel.generateContent.mockReset();
    googleGenerativeAIConstructor.mockReset();
    mockAnthropic.messages.create.mockReset();
    mockOpenAI.chat.completions.create.mockReset();
    openAIConstructor.mockReset();
    anthropicConstructor.mockReset();
    mockSafeLog.mockReset();

    envKeys.forEach(key => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    envKeys.forEach(key => {
      const value = originalEnv[key];
      if (typeof value === 'string') {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
  });

  it('prefers Gemini when a Gemini key is available', async () => {
    process.env.GOOGLE_GENAI_API_KEY = 'genai-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.GEMINI_TEXT_MODEL = 'models/gemini-test';

    vi.resetModules();
    const { generateWithMultiProvider } = await import('../../../../server/services/multi-ai-provider');

    geminiModel.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        titles: ['Gemini wins'],
        content: 'Gemini content that clearly exceeds the fallback length requirement.',
        photoInstructions: {
          lighting: 'soft',
          cameraAngle: 'eye-level',
          composition: 'balanced',
          styling: 'casual',
          mood: 'relaxed',
          technicalSettings: 'auto'
        }
      })
    });

    const response = await generateWithMultiProvider({
      user: { id: 1 },
      platform: 'instagram',
      allowsPromotion: 'no'
    });

    expect(response.provider).toBe('gemini-flash');
    expect(googleGenerativeAIConstructor).toHaveBeenCalledTimes(1);
    expect(googleGenerativeAIConstructor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'genai-key' }));
    expect(geminiModel.generateContent).toHaveBeenCalledTimes(1);
    const [geminiRequest] = geminiModel.generateContent.mock.calls[0] ?? [];
    expect(geminiRequest?.model).toBe('models/gemini-test');
    expect(geminiRequest?.contents?.[0]?.parts?.[0]?.text).toContain('instagram');
    expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('uses Gemini model names directly from env without normalization', async () => {
    process.env.GOOGLE_GENAI_API_KEY = 'genai-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.GEMINI_TEXT_MODEL = 'gemini-2.5-flash';

    vi.resetModules();
    const { generateWithMultiProvider } = await import('../../../../server/services/multi-ai-provider');

    geminiModel.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        titles: ['Direct model name'],
        content: 'Gemini uses the model name directly from environment variable without any normalization.',
        photoInstructions: {
          lighting: 'natural',
          cameraAngle: 'eye-level',
          composition: 'symmetrical',
          styling: 'minimalist',
          mood: 'serene',
          technicalSettings: 'auto'
        }
      })
    });

    await generateWithMultiProvider({
      user: { id: 4 },
      platform: 'instagram',
      allowsPromotion: 'no'
    });

    expect(geminiModel.generateContent).toHaveBeenCalledTimes(1);
    const [geminiRequest] = geminiModel.generateContent.mock.calls[0] ?? [];
    expect(geminiRequest?.model).toBe('gemini-2.5-flash');
  });

  it('falls back to Claude before OpenAI when Gemini is unavailable', async () => {
    delete process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.OPENAI_API_KEY = 'openai-key';

    vi.resetModules();
    const { generateWithMultiProvider } = await import('../../../../server/services/multi-ai-provider');

    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            titles: ['Claude selected'],
            content: 'Claude response ensuring enough detail for validation.',
            photoInstructions: {
              lighting: 'studio',
              cameraAngle: 'portrait',
              composition: 'centered',
              styling: 'formal',
              mood: 'confident',
              technicalSettings: 'manual'
            }
          })
        }
      ]
    });

    const result = await generateWithMultiProvider({
      user: { id: 2 },
      platform: 'tiktok',
      allowsPromotion: 'yes'
    });

    expect(result.provider).toBe('claude-haiku');
    expect(googleGenerativeAIConstructor).not.toHaveBeenCalled();
    expect(geminiModel.generateContent).not.toHaveBeenCalled();
    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('falls back to OpenAI after Claude when Claude fails', async () => {
    delete process.env.GOOGLE_GENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    process.env.OPENAI_API_KEY = 'openai-key';

    vi.resetModules();
    const { generateWithMultiProvider } = await import('../../../../server/services/multi-ai-provider');

    mockAnthropic.messages.create.mockRejectedValueOnce(new Error('Claude unavailable'));
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              titles: ['OpenAI fallback'],
              content: 'OpenAI provides the final fallback content after Claude fails.',
              photoInstructions: {
                lighting: 'dramatic',
                cameraAngle: 'low-angle',
                composition: 'dynamic',
                styling: 'bold',
                mood: 'intense',
                technicalSettings: 'advanced'
              }
            })
          }
        }
      ]
    });

    const response = await generateWithMultiProvider({
      user: { id: 3 },
      platform: 'reddit',
      allowsPromotion: 'no'
    });

    expect(response.provider).toBe('openai-gpt4o');
    expect(googleGenerativeAIConstructor).not.toHaveBeenCalled();
    expect(geminiModel.generateContent).not.toHaveBeenCalled();
    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);

    const claudeCallOrder = mockAnthropic.messages.create.mock.invocationCallOrder[0];
    const openAICallOrder = mockOpenAI.chat.completions.create.mock.invocationCallOrder[0];
    expect(claudeCallOrder).toBeLessThan(openAICallOrder);
  });
});
