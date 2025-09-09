import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRouter } from '../../server/routes/health.js';

describe('Health route', () => {
  it('returns ok status', async () => {
    const app = express();
    app.use('/api', healthRouter);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});