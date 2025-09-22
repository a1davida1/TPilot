import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const originalJwtSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const originalSendgridKey = process.env.SENDGRID_API_KEY;

function restoreEnvironment() {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalSendgridKey === undefined) {
    delete process.env.SENDGRID_API_KEY;
  } else {
    process.env.SENDGRID_API_KEY = originalSendgridKey;
  }
}

describe('setupAdminRoutes environment configuration', () => {
  afterEach(() => {
    restoreEnvironment();
  });

  it('initialises without JWT secret in test environment', async () => {
    vi.resetModules();
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const { setupAdminRoutes } = await import('../../server/admin-routes.js');

    const app = express();
    app.use(express.json());
    setupAdminRoutes(app);

    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(401);
  });

  it('rejects admin requests when JWT secret missing in production', async () => {
    vi.resetModules();
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_API_KEY = 'SG.test-key';

    const { setupAdminRoutes } = await import('../../server/admin-routes.js');

    const app = express();
    app.use(express.json());
    setupAdminRoutes(app);

    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ message: 'JWT secret not configured' });
  });
});