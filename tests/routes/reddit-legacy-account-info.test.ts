import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerApiRoutes } from '../../server/api-routes.ts';
import { registerRedditRoutes } from '../../server/reddit-routes.ts';

describe('Legacy Reddit account info route', () => {
  it('returns 404 because the handler has been removed', async () => {
    const app = express();
    app.use(express.json());

    registerApiRoutes(app);
    registerRedditRoutes(app);

    const response = await request(app).get('/api/reddit/account/123/info');

    expect(response.status).toBe(404);
  });
});