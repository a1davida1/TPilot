import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOpenAI = vi.hoisted(() => ({
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}));

const openAIConstructor = vi.hoisted(() => vi.fn(() => mockOpenAI));

vi.mock('openai', () => ({ default: openAIConstructor }));

describe('OpenRouter Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openAIConstructor.mockClear();
    mockOpenAI.chat.completions.create.mockClear();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
  });

  it('initializes with correct baseURL and headers', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';
    process.env.OPENROUTER_SITE_URL = 'https://test.com';
    process.env.OPENROUTER_APP_NAME = 'TestApp';

    vi.resetModules();
    await import('../../../server/lib/openrouter-client.js');

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: 'sk-or-test-key',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://test.com',
        'X-Title': 'TestApp'
      }
    });
  });

  it('uses default model x-ai/grok-4-fast', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'Test response' },
        finish_reason: 'stop'
      }]
    } as any);

    vi.resetModules();
    const { generateVision } = await import('../../../server/lib/openrouter-client.js');
    
    await generateVision({
      prompt: 'Test prompt',
      imageUrl: 'data:image/png;base64,test'
    });

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'x-ai/grok-4-fast'
      })
    );
  });

  it('includes image_url in vision payload', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'ok' } }]
    });

    vi.resetModules();
    const { generateVision } = await import('../../../server/lib/openrouter-client.js');

    const testImageUrl = 'data:image/png;base64,test123';
    await generateVision({
      prompt: 'describe this',
      imageUrl: testImageUrl
    });

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0]?.[0];
    expect(callArgs.messages[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'describe this' },
        { type: 'image_url', image_url: { url: testImageUrl } }
      ]
    });
  });

  it('applies custom temperature and penalties', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key';

    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'response' } }]
    });

    vi.resetModules();
    const { generateVision } = await import('../../../server/lib/openrouter-client.js');

    await generateVision({
      prompt: 'test',
      imageUrl: 'data:image/png;base64,x',
      temperature: 1.4,
      frequencyPenalty: 0.7,
      presencePenalty: 1.5
    });

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1.4,
        frequency_penalty: 0.7,
        presence_penalty: 1.5
      })
    );
  });

  it('throws error when API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;

    vi.resetModules();
    const { generateVision } = await import('../../../server/lib/openrouter-client.js');

    await expect(
      generateVision({ prompt: 'test', imageUrl: 'data:image/png;base64,x' })
    ).rejects.toThrow('OpenRouter client not initialized');
  });
});
