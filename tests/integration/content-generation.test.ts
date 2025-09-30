import request from 'supertest';
import { describe, test, beforeAll, beforeEach, expect, vi } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY ?? 'integration-gemini-key';

interface TestUser {
  id: number;
  email: string;
}

const authState: { user: TestUser | undefined } = {
  user: { id: 42, email: 'user@example.com' }
};

// Mock database and related dependencies
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 42, email: 'user@example.com', tier: 'pro' }])
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'generation-1' }])
      })
    })
  }
}));

vi.mock('../../shared/schema', () => ({
  users: {},
  contentGenerations: {}
}));

vi.mock('../../server/lib/logger-utils', () => ({
  safeLog: vi.fn()
}));

vi.mock('../../server/caption/multi-provider.js', () => ({
  generateWithMultiProvider: vi.fn().mockResolvedValue({
    titles: ['Generated Title'],
    content: 'Generated content',
    photoInstructions: { lighting: 'natural' },
    provider: 'gemini'
  })
}));

// Mock cache
const mockCache = new Map();
vi.mock('../../server/lib/cache.js', () => ({
  cache: {
    has: vi.fn((key) => mockCache.has(key)),
    get: vi.fn((key) => mockCache.get(key)),
    set: vi.fn((key, value) => mockCache.set(key, value))
  }
}));

const pipelineMock = vi.fn();
const pipelineTextOnlyMock = vi.fn();
const pipelineRewriteMock = vi.fn();
const createGenerationMock = vi.fn();

class MockInvalidImageError extends Error {}

vi.mock('../../server/caption/geminiPipeline.ts', () => ({
  pipeline: pipelineMock,
  InvalidImageError: MockInvalidImageError
}));

vi.mock('../../server/caption/textOnlyPipeline.ts', () => ({
  pipelineTextOnly: pipelineTextOnlyMock
}));

vi.mock('../../server/caption/rewritePipeline.ts', () => ({
  pipelineRewrite: pipelineRewriteMock
}));

vi.mock('../../server/storage.ts', () => ({
  storage: {
    createGeneration: createGenerationMock
  }
}));

vi.mock('../../server/middleware/auth.ts', () => {
  type AuthenticatedRequest = Request & { user?: TestUser };
  const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ message: 'Access token required' });
      return;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== 'valid-token') {
      res.status(401).json({ message: 'Access token required' });
      return;
    }

    if (authState.user) {
      req.user = authState.user;
    }

    next();
  };

  return { authenticateToken };
});

type MockCaption = {
  caption: string;
  alt?: string;
  hashtags?: string[];
  cta?: string;
  mood?: string;
  style?: string;
};

type MockPipelineResult = {
  provider: string;
  final?: MockCaption;
  ranked?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  facts?: Record<string, unknown>;
};

const createPipelineResult = (overrides?: Partial<MockPipelineResult>): MockPipelineResult => {
  const baseFinal: MockCaption = {
    caption: 'Generated caption from pipeline',
    alt: 'Alt text for generated caption',
    hashtags: ['#spark', '#glow'],
    cta: 'Tap to explore more',
    mood: 'confident',
    style: 'playful'
  };

  const result: MockPipelineResult = {
    provider: 'gemini',
    final: { ...baseFinal },
    ranked: { final: { ...baseFinal }, reason: 'Top pick' },
    variants: [
      { caption: 'Generated caption from pipeline', hashtags: ['#spark'] },
      { caption: 'Second angle caption', hashtags: ['#glow'] }
    ],
    facts: { palette: ['sunset'], subject: 'creator' }
  };

  if (overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, 'final')) {
      result.final = overrides.final
        ? { ...baseFinal, ...overrides.final }
        : undefined;
    }
    if (overrides.provider) {
      result.provider = overrides.provider;
    }
    if (overrides.ranked) {
      result.ranked = overrides.ranked;
    }
    if (overrides.variants) {
      result.variants = overrides.variants;
    }
    if (overrides.facts) {
      result.facts = overrides.facts;
    }
  }

  return result;
};

describe('Caption generation route contract', () => {
  let app: express.Application;
  let InvalidImageErrorCtor: new (message: string) => Error;

  const imageUrl = 'https://cdn.example.com/image.jpg';

  const sendGenerateRequest = (body: Record<string, unknown>, token = 'valid-token') => {
    const reqBuilder = request(app).post('/api/caption/generate');
    if (token) {
      reqBuilder.set('Authorization', `Bearer ${token}`);
    }
    return reqBuilder.send(body);
  };

  beforeAll(async () => {
    const routeModule = await import('../../server/routes/caption.ts');

    InvalidImageErrorCtor = MockInvalidImageError;

    app = express();
    app.use(express.json());
    app.use('/api/caption', routeModule.captionRouter);

    // Use proper route imports instead of hardcoded implementations
    // The routes are properly mocked through the vi.mock declarations above
  });

  beforeEach(() => {
    vi.clearAllMocks();
    pipelineMock.mockResolvedValue(createPipelineResult());
    createGenerationMock.mockResolvedValue({ id: 'generation-1' });
    authState.user = { id: 42, email: 'user@example.com' };
  });

  test('rejects requests without authentication', async () => {
    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram' }, '');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Access token required' });
    expect(pipelineMock).not.toHaveBeenCalled();
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  test('requires imageUrl in the payload', async () => {
    const response = await sendGenerateRequest({ platform: 'instagram' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(pipelineMock).not.toHaveBeenCalled();
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  test('invokes the pipeline with default nsfw value when not provided', async () => {
    await sendGenerateRequest({ imageUrl, platform: 'instagram' });

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(pipelineMock).toHaveBeenCalledWith({
      imageUrl,
      platform: 'instagram',
      nsfw: false
    });
  });

  test('forwards persona options to the pipeline when present', async () => {
    const personaRequest = {
      imageUrl,
      platform: 'instagram',
      voice: 'bold_voice',
      style: 'vibrant',
      mood: 'dramatic',
      nsfw: true
    };

    await sendGenerateRequest(personaRequest);

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(pipelineMock).toHaveBeenCalledWith(personaRequest);
  });

  test('returns the pipeline payload and persists the generation', async () => {
    const pipelineResponse = createPipelineResult({
      final: {
        caption: 'Stored caption',
        hashtags: ['#stored'],
        alt: 'Stored alt text',
        mood: 'confident',
        style: 'studio'
      }
    });
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram', style: 'studio' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(pipelineResponse);
    expect(createGenerationMock).toHaveBeenCalledTimes(1);
    expect(createGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      platform: 'instagram',
      style: 'studio',
      theme: 'image_based',
      titles: ['Stored caption'],
      content: 'Stored caption',
      allowsPromotion: false
    }));
  });

  test('falls back to the voice as style when no explicit style is provided', async () => {
    const pipelineResponse = createPipelineResult({
      final: {
        caption: 'Voice guided caption'
      }
    });
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'tiktok', voice: 'moody_voice' });

    expect(response.status).toBe(200);
    expect(createGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'tiktok',
      style: 'moody_voice'
    }));
  });

  test('skips persistence when the authenticated user is not attached', async () => {
    authState.user = undefined;
    const pipelineResponse = createPipelineResult();
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'reddit' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(pipelineResponse);
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  test('does not fail the response when storage.createGeneration throws', async () => {
    const pipelineResponse = createPipelineResult({
      final: {
        caption: 'Resilient caption'
      }
    });
    pipelineMock.mockResolvedValueOnce(pipelineResponse);
    createGenerationMock.mockRejectedValueOnce(new Error('database offline'));

    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(pipelineResponse);
  });

  test('surfaces unsupported image format errors as 422 responses', async () => {
    const invalidError = new InvalidImageErrorCtor('unsupported content-type: text/plain');
    pipelineMock.mockRejectedValueOnce(invalidError);

    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'unsupported content-type: text/plain' });
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  test('returns a 500 error for unexpected pipeline failures', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('Gemini outage'));

    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram' });

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
    expect(createGenerationMock).not.toHaveBeenCalled();
  });
});