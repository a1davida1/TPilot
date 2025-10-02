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

  it('normalizes whitespace in base64 image payloads before sending to OpenAI', async () => {
    vi.resetModules();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'development';
    delete process.env.CAPTION_DEBUG_IMAGES;

    const base64PayloadWithWhitespace = `${'A'.repeat(50)} ${'B'.repeat(50)}\n${'C'.repeat(50)} DDDD==`;
    const imageUrl = `data:image/png;base64,${base64PayloadWithWhitespace}`;
    const expectedImageUrl = `data:image/png;base64,${base64PayloadWithWhitespace.replace(/\s+/g, '')}`;

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

    expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenAIInstance.chat.completions.create.mock.calls[0]?.[0];
    expect(callArgs && typeof callArgs === 'object').toBe(true);

    const messages = (callArgs as { messages: Array<{ role: string; content: unknown }> }).messages;
    const userMessage = messages.find(message => message.role === 'user');
    expect(userMessage).toBeDefined();
    if (!userMessage) throw new Error('Expected user message to be defined');

    expect(Array.isArray(userMessage.content)).toBe(true);
    if (!Array.isArray(userMessage.content)) throw new Error('Expected user message content to be an array');

    const imageContent = userMessage.content.find(
      (part): part is { type: string; image_url?: { url?: string } } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        (part as { type?: unknown }).type === 'image_url'
    );

    expect(imageContent?.image_url?.url).toBe(expectedImageUrl);
    expect(imageContent?.image_url?.url?.includes(' ')).toBe(false);
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