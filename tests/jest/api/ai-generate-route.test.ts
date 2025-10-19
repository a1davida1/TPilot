import { testApiHandler } from 'next-test-api-route-handler';
import { sign } from 'jsonwebtoken';

import type { CaptionResult } from '@shared/types/caption';

type PipelineModule = typeof import('@server/caption/openrouterPipeline');

jest.mock('@server/caption/openrouterPipeline', () => {
  const actual = jest.requireActual<PipelineModule>('@server/caption/openrouterPipeline');
  return {
    ...actual,
    pipeline: jest.fn(),
  };
});

const pipeline = jest.requireMock('@server/caption/openrouterPipeline') as {
  pipeline: jest.MockedFunction<PipelineModule['pipeline']>;
};

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
  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeAuthHeader = (userId: number) => `Bearer ${sign({ userId }, process.env.JWT_SECRET || 'test-secret')}`;

  it('returns caption data when pipeline succeeds', async () => {
    const caption: CaptionResult = {
      final: 'caption-ready',
      ranked: ['caption-ready'],
    };
    pipeline.pipeline.mockResolvedValue(caption);

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
          })
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
            voice: 'confident',
          },
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toEqual(caption);
        expect(body.success).toBe(true);
      },
    });

    expect(pipeline.pipeline).toHaveBeenCalledWith({
      imageUrl: 'https://cdn.example.com/photo.jpg',
      platform: 'reddit',
      voice: 'confident',
      nsfw: false,
    });
  });

  it('rejects unauthenticated requests', async () => {
    pipeline.pipeline.mockResolvedValue({} as CaptionResult);

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
          })
        );
        res.status(response.status).send(await response.text());
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            imageUrl: 'https://cdn.example.com/photo.jpg',
            platform: 'reddit',
          },
        });
        expect(response.status).toBe(401);
      },
    });

    expect(pipeline.pipeline).not.toHaveBeenCalled();
  });

  it('validates payload and returns 400 for bad input', async () => {
    pipeline.pipeline.mockResolvedValue({} as CaptionResult);

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
          })
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: {
            platform: 'reddit',
          },
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invalid request payload');
      },
    });

    expect(pipeline.pipeline).not.toHaveBeenCalled();
  });
});
