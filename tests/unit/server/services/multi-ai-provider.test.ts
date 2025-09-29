
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGemini = vi.hoisted(() => ({
  generate: vi.fn()
}));

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

const googleGenAIConstructor = vi.hoisted(() => vi.fn(() => mockGemini));
const openAIConstructor = vi.hoisted(() => vi.fn(() => mockOpenAI));
const anthropicConstructor = vi.hoisted(() => vi.fn(() => mockAnthropic));

vi.mock('@google/genai', () => ({ GoogleGenAI: googleGenAIConstructor }));
vi.mock('openai', () => ({ default: openAIConstructor }));
vi.mock('@anthropic-ai/sdk', () => ({ default: anthropicConstructor }));
vi.mock('../../../../server/lib/logger-utils.ts', () => ({ safeLog: mockSafeLog }));

const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY'] as const;
type EnvKey = typeof envKeys[number];

const originalEnv: Record<EnvKey, string | undefined> = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY
};

describe('generateWithMultiProvider provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGemini.generate.mockReset();
    mockAnthropic.messages.create.mockReset();
    mockOpenAI.chat.completions.create.mockReset();
    googleGenAIConstructor.mockReset();
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
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';

    vi.resetModules();
    const { generateWithMultiProvider } = await import('../../../../server/services/multi-ai-provider');

    mockGemini.generate.mockResolvedValueOnce({
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
    expect(mockGemini.generate).toHaveBeenCalledTimes(1);
    expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('falls back to Claude before OpenAI when Gemini is unavailable', async () => {
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
    expect(mockGemini.generate).not.toHaveBeenCalled();
    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('falls back to OpenAI after Claude when Claude fails', async () => {
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
    expect(mockGemini.generate).not.toHaveBeenCalled();
    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);

    const claudeCallOrder = mockAnthropic.messages.create.mock.invocationCallOrder[0];
    const openAICallOrder = mockOpenAI.chat.completions.create.mock.invocationCallOrder[0];
    expect(claudeCallOrder).toBeLessThan(openAICallOrder);
  });
});
