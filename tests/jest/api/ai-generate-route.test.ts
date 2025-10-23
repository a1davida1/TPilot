import { testApiHandler } from 'next-test-api-route-handler';
import { sign } from 'jsonwebtoken';

import type { CaptionResult } from '@shared/types/caption';

type PipelineModule = typeof import('@server/caption/openrouterPipeline');
type PersonalizationModule = typeof import('@server/caption/personalization-context');
type DbModule = typeof import('@server/db');

const selectLimitMock = jest.fn();
const selectWhereMock = jest.fn();
const selectFromMock = jest.fn();
const selectMock = jest.fn();
const insertReturningMock = jest.fn();
const insertValuesMock = jest.fn();
const insertMock = jest.fn();
const loadPersonalizationMock = jest.fn();

jest.mock('@server/db', () => ({
  db: {
    select: selectMock,
    insert: insertMock,
  },
}) satisfies DbModule);

jest.mock('@server/caption/openrouterPipeline', () => {
  const actual = jest.requireActual<PipelineModule>('@server/caption/openrouterPipeline');
  return {
    ...actual,
    pipeline: jest.fn(),
  };
});

jest.mock('@server/caption/personalization-context', () => ({
  loadCaptionPersonalizationContext: loadPersonalizationMock,
}));

const pipeline = jest.requireMock('@server/caption/openrouterPipeline') as {
  pipeline: jest.MockedFunction<PipelineModule['pipeline']>;
};

const personalization = jest.requireMock('@server/caption/personalization-context') as {
  loadCaptionPersonalizationContext: jest.MockedFunction<PersonalizationModule['loadCaptionPersonalizationContext']>;
};

const { OpenRouterError } = jest.requireActual<PipelineModule>('@server/caption/openrouterPipeline');

function buildRequestBody(req: Parameters<Parameters<typeof testApiHandler>[0]['handler']>[0]): string {
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (req.body) {
    return JSON.stringify(req.body);
  }
  return JSON.stringify({});
}

describe('POST /api/ai/generate', () => {
  let capturedInsertValues: Array<Record<string, unknown>>;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
  });

  const makeAuthHeader = (userId: number) => `Bearer ${sign({ userId }, process.env.JWT_SECRET || 'test-secret')}`;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedInsertValues = [];

    const limitMock = jest.fn().mockResolvedValue([{ tier: 'pro', isAdmin: false }]);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    selectMock.mockReturnValue({ from: fromMock });

    insertMock.mockReturnValue({
      values: jest.fn().mockImplementation((values: Record<string, unknown>) => {
        capturedInsertValues.push(values);
        const index = capturedInsertValues.length;
        return {
          returning: jest.fn().mockResolvedValue([
            {
              id: index,
              createdAt: new Date(`2025-01-0${index}T00:00:00.000Z`),
              ...values,
            },
          ]),
        };
      }),
    });

    personalization.loadCaptionPersonalizationContext.mockResolvedValue({ lines: ['personalized'] });
  });

  it('rejects unauthenticated requests', async () => {
    pipeline.pipeline.mockResolvedValue({} as Awaited<ReturnType<PipelineModule['pipeline']>>);

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'POST';
        req.headers = {
          ...(req.headers || {}),
          'content-type': 'application/json',
        };
      },
      handler: async (req, res) => {
        const { POST } = await import('../../../app/api/ai/generate/route');
        const response = await POST(
          new Request('http://localhost/api/ai/generate', {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: buildRequestBody(req),
          }),
        );
        res.status(response.status).send(await response.text());
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            imageUrl: 'https://cdn.example.com/photo.jpg',
            platform: 'reddit',
            targets: [
              {
                subreddit: 'example',
              },
            ],
          },
        });
        expect(response.status).toBe(401);
      },
    });

    expect(pipeline.pipeline).not.toHaveBeenCalled();
    expect(personalization.loadCaptionPersonalizationContext).not.toHaveBeenCalled();
  });

  it('validates payload and returns 400 for bad input', async () => {
    pipeline.pipeline.mockResolvedValue({} as Awaited<ReturnType<PipelineModule['pipeline']>>);

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'POST';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(55),
          'content-type': 'application/json',
        };
      },
      handler: async (req, res) => {
        const { POST } = await import('../../../app/api/ai/generate/route');
        const response = await POST(
          new Request('http://localhost/api/ai/generate', {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: buildRequestBody(req),
          }),
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            imageUrl: 'https://cdn.example.com/photo.jpg',
            platform: 'reddit',
          },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invalid request payload');
      },
    });

    expect(pipeline.pipeline).not.toHaveBeenCalled();
    expect(personalization.loadCaptionPersonalizationContext).not.toHaveBeenCalled();
  });

  it('processes multiple targets concurrently while preserving order and writing DB rows', async () => {
    const responsesByVoice: Record<string, Awaited<ReturnType<PipelineModule['pipeline']>>> = {
      flirty_playful: {
        final: {
          caption: 'Caption A',
          alt: 'Alt A',
          hashtags: ['#a'],
          cta: 'CTA A',
          mood: 'mood-a',
          style: 'style-a',
          nsfw: false,
          titles: ['Title A'],
        },
        ranked: { reason: 'Rank A' },
        variants: [{ caption: 'Variant A' }],
        titles: ['Title A'],
      },
      gamer_nerdy: {
        final: {
          caption: 'Caption B',
          alt: 'Alt B',
          hashtags: ['#b'],
          cta: 'CTA B',
          mood: 'mood-b',
          style: 'style-b',
          nsfw: false,
          titles: ['Title B'],
        },
        ranked: { reason: 'Rank B' },
        variants: [{ caption: 'Variant B' }],
        titles: ['Title B'],
      },
    };

    pipeline.pipeline.mockImplementation(async ({ voice }) => {
      const payload = responsesByVoice[voice] ?? responsesByVoice.flirty_playful;
      if (voice === 'gamer_nerdy') {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return payload;
    });

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'POST';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(101),
          'content-type': 'application/json',
        };
      },
      handler: async (req, res) => {
        const { POST } = await import('../../../app/api/ai/generate/route');
        const response = await POST(
          new Request('http://localhost/api/ai/generate', {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: buildRequestBody(req),
          }),
        );
        const json = await response.json();
        res.status(response.status).json(json);
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            imageUrl: 'https://cdn.example.com/photo.jpg',
            platform: 'reddit',
            nsfw: false,
            targets: [
              {
                subreddit: 'firstsub',
                persona: 'flirty_playful',
                tones: ['story'],
              },
              {
                subreddit: 'secondsub',
                persona: 'gamer_nerdy',
                tones: ['tease', 'promo'],
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.data.variants).toHaveLength(2);
        expect(body.data.variants[0]).toMatchObject({
          subreddit: 'firstsub',
          persona: 'flirty_playful',
          suggestion: {
            caption: 'Caption A',
            titles: ['Title A'],
          },
        });
        expect(body.data.variants[1]).toMatchObject({
          subreddit: 'secondsub',
          persona: 'gamer_nerdy',
          suggestion: {
            caption: 'Caption B',
            titles: ['Title B'],
          },
        });
      },
    });

    expect(pipeline.pipeline).toHaveBeenCalledTimes(2);
    expect(capturedInsertValues).toHaveLength(2);
    expect(capturedInsertValues[0]?.subreddit).toBe('firstsub');
    expect(capturedInsertValues[1]?.subreddit).toBe('secondsub');
  });

  it('aggregates errors and surfaces OpenRouter failures', async () => {
    pipeline.pipeline
      .mockResolvedValueOnce({
        final: {
          caption: 'Caption ok',
          titles: ['Ok'],
        },
        ranked: { reason: 'ok' },
        variants: [],
        titles: ['Ok'],
      } as Awaited<ReturnType<PipelineModule['pipeline']>>)
      .mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new OpenRouterError('OpenRouter unavailable');
      });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'POST';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(202),
          'content-type': 'application/json',
        };
      },
      handler: async (req, res) => {
        const { POST } = await import('../../../app/api/ai/generate/route');
        const response = await POST(
          new Request('http://localhost/api/ai/generate', {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: buildRequestBody(req),
          }),
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            imageUrl: 'https://cdn.example.com/photo.jpg',
            platform: 'reddit',
            targets: [
              {
                subreddit: 'successsub',
                persona: 'flirty_playful',
              },
              {
                subreddit: 'failsub',
                persona: 'gamer_nerdy',
              },
            ],
          },
        });

        expect(response.status).toBe(500);
        const body = await response.json();
        expect(body.error).toBe('Internal server error');
      },
    });

    expect(pipeline.pipeline).toHaveBeenCalledTimes(2);
    expect(capturedInsertValues).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalled();
    const [, loggedError] = consoleSpy.mock.calls[0] ?? [];
    expect(loggedError).toBeInstanceOf(OpenRouterError);
    consoleSpy.mockRestore();
  });
});
