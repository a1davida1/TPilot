import { describe, test, beforeEach, beforeAll, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const authState: { user?: { id: number; email: string } } = {};

const createPipelineResult = (overrides: Record<string, unknown> = {}) => {
  const result = {
    content: 'Generated content text',
    titles: ['Title 1', 'Title 2', 'Title 3'],
    photoInstructions: ['Photo instruction 1', 'Photo instruction 2'],
    platform: 'instagram'
  };

  if (overrides.content) {
    result.content = overrides.content as string;
  }
  if (overrides.titles) {
    result.titles = overrides.titles as string[];
  }
  if (overrides.photoInstructions) {
    result.photoInstructions = overrides.photoInstructions as string[];
  }
  if (overrides.platform) {
    result.platform = overrides.platform as string;
  }

  return result;
};

const pipelineMock = vi.fn();
const pipelineTextOnlyMock = vi.fn();
const pipelineRewriteMock = vi.fn();
const createGenerationMock = vi.fn();

class MockInvalidImageError extends Error {}

vi.mock('../../server/caption/geminiPipeline.js', () => ({
  pipeline: pipelineMock,
  InvalidImageError: MockInvalidImageError
}));

vi.mock('../../server/caption/textOnlyPipeline.js', () => ({
  pipeline: pipelineTextOnlyMock
}));

vi.mock('../../server/caption/rewritePipeline.js', () => ({
  pipeline: pipelineRewriteMock
}));

vi.mock('../../server/storage.js', () => ({
  storage: {
    createGeneration: createGenerationMock
  }
}));

vi.mock('../../server/middleware/auth.js', () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Access token required' });
    }
    (req as unknown as { user: typeof authState.user }).user = authState.user;
    next();
  }
}));

const createPipelineResult_old = (overrides: Record<string, unknown> = {}) => {
  const result = {
    content: 'Generated content text',
    titles: ['Title 1', 'Title 2', 'Title 3'],
    photoInstructions: ['Photo instruction 1', 'Photo instruction 2'],
    platform: 'instagram',
    imageAnalyzed: false,
    cached: false,
    fallbackUsed: false,
    tone: 'professional',
    mood: 'upbeat',
    facts: [] as string[],
    hashtags: ['#generated', '#content'],
    alt: 'Alt text for image',
    cta: 'Call to action',
    style: 'modern',
    safety_level: 'safe',
    nsfw: false,
    ranked: [] as string[],
    variants: [] as string[]
  };

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'content' && typeof value === 'string') {
      result.content = value;
    }
    if (key === 'titles' && Array.isArray(value)) {
      result.titles = value as string[];
    }
    if (key === 'photoInstructions' && Array.isArray(value)) {
      result.photoInstructions = value as string[];
    }
    if (key === 'platform' && typeof value === 'string') {
      result.platform = value;
    }
    if (key === 'imageAnalyzed' && typeof value === 'boolean') {
      result.imageAnalyzed = value;
    }
    if (key === 'cached' && typeof value === 'boolean') {
      result.cached = value;
    }
    if (key === 'fallbackUsed' && typeof value === 'boolean') {
      result.fallbackUsed = value;
    }
    if (overrides.tone) {
      result.tone = overrides.tone as string;
    }
    if (overrides.mood) {
      result.mood = overrides.mood as string;
    }
    if (overrides.facts) {
      result.facts = overrides.facts as string[];
    }
    if (overrides.hashtags) {
      result.hashtags = overrides.hashtags as string[];
    }
    if (overrides.alt) {
      result.alt = overrides.alt as string;
    }
    if (overrides.cta) {
      result.cta = overrides.cta as string;
    }
    if (overrides.style) {
      result.style = overrides.style as string;
    }
    if (overrides.safety_level) {
      result.safety_level = overrides.safety_level as string;
    }
    if (overrides.nsfw) {
      result.nsfw = overrides.nsfw as boolean;
    }
    if (overrides.ranked) {
      result.ranked = overrides.ranked as string[];
    }
    if (overrides.variants) {
      result.variants = overrides.variants as string[];
    }
    if (overrides.facts) {
      result.facts = overrides.facts as string[];
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
    const routeModule = await import('../../server/routes/caption.js');

    InvalidImageErrorCtor = MockInvalidImageError;

    app = express();
    app.use(express.json());
    app.use('/api/caption', routeModule.captionRouter);
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

    expect(response.status).toBe(500);
    expect(typeof response.body.error).toBe('string');
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

  test('forwards persona request fields to the pipeline', async () => {
    const personaRequest = {
      imageUrl,
      platform: 'tiktok',
      voice: 'funny',
      mood: 'upbeat'
    };

    await sendGenerateRequest(personaRequest);

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(pipelineMock).toHaveBeenCalledWith(personaRequest);
  });

  test('returns the pipeline response data directly on success', async () => {
    const pipelineResponse = createPipelineResult({
      content: 'Custom generated content',
      titles: ['Custom Title 1', 'Custom Title 2'],
      photoInstructions: ['Custom instruction'],
      platform: 'instagram'
    });
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'instagram', style: 'studio' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(pipelineResponse);
    expect(createGenerationMock).toHaveBeenCalledTimes(1);
    expect(createGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      platform: 'instagram',
      style: 'studio'
    }));
  });

  test('stores generations with the appropriate style field for TikTok voice personas', async () => {
    const pipelineResponse = createPipelineResult({
      content: 'TikTok content',
      titles: ['TikTok Title'],
      photoInstructions: ['TikTok instruction'],
      platform: 'tiktok'
    });
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'tiktok', voice: 'moody_voice' });

    expect(response.status).toBe(200);
    expect(createGenerationMock).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'tiktok',
      style: 'moody_voice'
    }));
  });

  test('skips storage for unauthenticated requests', async () => {
    authState.user = undefined;
    const pipelineResponse = createPipelineResult();
    pipelineMock.mockResolvedValueOnce(pipelineResponse);

    const response = await sendGenerateRequest({ imageUrl, platform: 'reddit' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(pipelineResponse);
    expect(createGenerationMock).not.toHaveBeenCalled();
  });

  test('returns a 200 response even when storage fails', async () => {
    const pipelineResponse = createPipelineResult({
      content: 'Pipeline succeeded',
      platform: 'instagram'
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
    expect(response.body).toEqual({ error: 'Gemini outage' });
    expect(createGenerationMock).not.toHaveBeenCalled();
  });
});