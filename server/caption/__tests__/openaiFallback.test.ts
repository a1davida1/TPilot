import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mockOpenAIInstance = vi.hoisted(() => ({
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}));

const mockOpenAIConstructor = vi.hoisted(() => vi.fn(() => mockOpenAIInstance));

vi.mock('openai', () => ({ default: mockOpenAIConstructor }));

describe('openAICaptionFallback safe responses', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalDebugImages = process.env.CAPTION_DEBUG_IMAGES;

  beforeEach(() => {
    mockOpenAIInstance.chat.completions.create.mockReset();
    mockOpenAIConstructor.mockReset();
    mockOpenAIConstructor.mockImplementation(() => mockOpenAIInstance);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }

    if (originalDebugImages === undefined) {
      delete process.env.CAPTION_DEBUG_IMAGES;
    } else {
      process.env.CAPTION_DEBUG_IMAGES = originalDebugImages;
    }
  });

  it('short-circuits with safe template when API key is missing', async () => {
    vi.resetModules();
    delete process.env.OPENAI_API_KEY;
    process.env.NODE_ENV = 'development';

    const inferenceModule = await import('../inferFallbackFromFacts');
    const complianceSpy = vi.spyOn(inferenceModule, 'ensureFallbackCompliance');
    const rankingFallback = await import('../rankingGuards');
    const { openAICaptionFallback } = await import('../openaiFallback');

    const result = await openAICaptionFallback({
      platform: 'instagram',
      voice: 'confident'
    });

    expect(mockOpenAIInstance.chat.completions.create).not.toHaveBeenCalled();
    expect(complianceSpy).toHaveBeenCalledTimes(5);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
    const primary = result[0];
    expect(primary.caption).toBe(rankingFallback.safeFallbackCaption);
    expect(primary.hashtags).toEqual(Array.from(rankingFallback.safeFallbackHashtags));
    expect(primary.cta).toBe(rankingFallback.safeFallbackCta);
    expect(primary.alt).toBe('Engaging social media content');
    expect(primary.mood).toBe('engaging');
    expect(primary.style).toBe('authentic');
    expect(primary.safety_level).toBe('normal');
    expect(primary.nsfw).toBe(false);
    for (const variant of result) {
      expect(variant.alt).toBe('Engaging social media content');
      expect(variant.safety_level).toBe('normal');
    }

    complianceSpy.mockRestore();
  });

  it('returns safe template when OpenAI throws', async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'development';

    const inferenceModule = await import('../inferFallbackFromFacts');
    const complianceSpy = vi.spyOn(inferenceModule, 'ensureFallbackCompliance');
    const rankingFallback = await import('../rankingGuards');
    const { openAICaptionFallback } = await import('../openaiFallback');

    mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(new Error('Boom'));

    const result = await openAICaptionFallback({
      platform: 'instagram',
      voice: 'confident'
    });

    expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(complianceSpy).toHaveBeenCalledTimes(5);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
    const primary = result[0];
    expect(primary.caption).toBe(rankingFallback.safeFallbackCaption);
    expect(primary.hashtags).toEqual(Array.from(rankingFallback.safeFallbackHashtags));
    expect(primary.cta).toBe(rankingFallback.safeFallbackCta);
    expect(primary.alt).toBe('Engaging social media content');
    expect(primary.mood).toBe('engaging');
    expect(primary.style).toBe('authentic');
    expect(primary.safety_level).toBe('normal');
    expect(primary.nsfw).toBe(false);

    complianceSpy.mockRestore();
  });

  it('does not emit raw image URLs when diagnostics are disabled in production', async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    delete process.env.CAPTION_DEBUG_IMAGES;

    const imageUrl = 'https://sensitive.example.com/private/image.png?token=secret';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              caption: 'Caption',
              hashtags: ['#tag'],
              cta: 'CTA',
              alt: 'Alt',
              safety_level: 'normal',
              mood: 'confident',
              style: 'authentic',
              nsfw: false
            })
          }
        }
      ]
    });

    const { openAICaptionFallback } = await import('../openaiFallback');

    await openAICaptionFallback({ platform: 'instagram', voice: 'confident', imageUrl });

    const loggedMessages = consoleSpy.mock.calls.flat().filter((value): value is string => typeof value === 'string');
    expect(loggedMessages.some(message => message.includes(imageUrl))).toBe(false);

    consoleSpy.mockRestore();
  });

  it('redacts remote image diagnostics when debug logging enabled', async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'development';
    process.env.CAPTION_DEBUG_IMAGES = 'true';

    const imageUrl = 'https://assets.example.com/photo.jpg';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              caption: 'Caption',
              hashtags: ['#tag'],
              cta: 'CTA',
              alt: 'Alt',
              safety_level: 'normal',
              mood: 'confident',
              style: 'authentic',
              nsfw: false
            })
          }
        }
      ]
    });

    const { openAICaptionFallback } = await import('../openaiFallback');

    await openAICaptionFallback({ platform: 'instagram', voice: 'confident', imageUrl });

    const loggedMessages = consoleSpy.mock.calls.flat().filter((value): value is string => typeof value === 'string');
    expect(loggedMessages.some(message => message.includes(imageUrl))).toBe(false);
    expect(loggedMessages.some(message => /remote image URL/.test(message))).toBe(true);

    consoleSpy.mockRestore();
  });

  it('redacts data URL diagnostics when debug logging enabled', async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'development';
    process.env.CAPTION_DEBUG_IMAGES = 'true';

    const base64Payload = 'A'.repeat(200);
    const imageUrl = `data:image/png;base64,${base64Payload}`;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              caption: 'Caption',
              hashtags: ['#tag'],
              cta: 'CTA',
              alt: 'Alt',
              safety_level: 'normal',
              mood: 'confident',
              style: 'authentic',
              nsfw: false
            })
          }
        }
      ]
    });

    const { openAICaptionFallback } = await import('../openaiFallback');

    await openAICaptionFallback({ platform: 'instagram', voice: 'confident', imageUrl });

    const loggedMessages = consoleSpy.mock.calls.flat().filter((value): value is string => typeof value === 'string');
    expect(loggedMessages.some(message => message.includes(base64Payload))).toBe(false);
    expect(loggedMessages.some(message => /data URL/.test(message))).toBe(true);

    consoleSpy.mockRestore();
  });
});