import type { Express } from 'express';
import type { Server } from 'http';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../../server/lib/api-prefix.ts';

let createApp: typeof import('../../server/index.ts')['createApp'];

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server || !server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('OpenAPI specification delivery', () => {
  let app: Express;
  let server: Server | undefined;

  beforeAll(async () => {
    ({ createApp } = await import('../../server/index.ts'));
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });

    app = result.app;
    server = result.server;
  });

  afterAll(async () => {
    await closeServer(server);
  });

  it('serves the OpenAPI document from the prefixed route', async () => {
    const response = await request(app).get(`${API_PREFIX}/openapi.yaml`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('yaml');
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('ThottoPilot API');
  });

  it('responds with 304 when the client presents a matching ETag', async () => {
    const firstResponse = await request(app).get(`${API_PREFIX}/openapi.yaml`);
    const etag = firstResponse.headers.etag;

    expect(typeof etag).toBe('string');

    if (typeof etag !== 'string') {
      throw new Error('Expected OpenAPI response to include an ETag header.');
    }

    const cachedResponse = await request(app)
      .get(`${API_PREFIX}/openapi.yaml`)
      .set('If-None-Match', etag);

    expect(cachedResponse.status).toBe(304);
    expect(cachedResponse.text).toBe('');
  });
});
