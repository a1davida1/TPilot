import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { describe, beforeEach, afterEach, it, expect, vi, type Mock } from 'vitest';

const fallbackResult = {
  caption: 'Fallback caption for disabled Gemini',
  hashtags: ['#fallbackOne', '#fallbackTwo', '#fallbackThree'],
  safety_level: 'normal',
  alt: 'Detailed alt text describing the fallback caption for accessibility.',
  mood: 'confident',
  style: 'authentic',
  cta: 'Check this out',
  nsfw: false,
};

describe('/api/caption/generate OpenAI fallback', () => {
  let app: express.Application;
  let openAIFallbackMock: Mock;
  let createGenerationMock: Mock;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock('../../server/caption/openaiFallback.ts', () => ({
      openAICaptionFallback: vi.fn().mockResolvedValue(fallbackResult),
    }));

    vi.doMock('../../server/lib/gemini.ts', () => ({
      __esModule: true,
      isGeminiAvailable: vi.fn(() => false),
      textModel: { generateContent: vi.fn() },
      visionModel: { generateContent: vi.fn() },
    }));

    createGenerationMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../../server/storage.ts', () => ({
      storage: {
        createGeneration: createGenerationMock,
      },
    }));

    vi.doMock('../../server/middleware/auth.ts', () => ({
      authenticateToken: (req: Request & { user?: { id: number } }, _res: Response, next: NextFunction) => {
        req.user = { id: 101 };
        next();
      },
    }));

    app = express();
    app.use(express.json());
    const { captionRouter } = await import('../../server/routes/caption.ts');
    app.use('/api/caption', captionRouter);

    const { openAICaptionFallback } = await import('../../server/caption/openaiFallback.ts');
    openAIFallbackMock = vi.mocked(openAICaptionFallback);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns an OpenAI-backed payload when Gemini is unavailable', async () => {
    const requestBody = {
      imageUrl: 'https://cdn.example.com/image.jpg',
      platform: 'instagram',
      voice: 'flirty_playful',
    };

    const response = await request(app)
      .post('/api/caption/generate')
      .send(requestBody);

    expect(response.status).toBe(200);
    expect(openAIFallbackMock).toHaveBeenCalledWith(requestBody);
    expect(response.body.provider).toBe('openai');
    expect(Array.isArray(response.body.titles)).toBe(true);
    expect(response.body.titles.length).toBeGreaterThan(0);
    expect(response.body.final).toBeDefined();
    expect(response.body.final.titles?.length ?? 0).toBeGreaterThan(0);
    expect(response.body.ranked.reason).toContain('OpenAI fallback selected because Gemini API is not configured');
    expect(createGenerationMock).toHaveBeenCalled();
  });
});