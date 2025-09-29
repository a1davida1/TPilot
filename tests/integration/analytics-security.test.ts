import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

interface MockUser { id: number }

type AuthenticatedRequest = Request & { user?: MockUser };

let authImpl: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void = (_req, _res, next) => next();

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: (req: AuthenticatedRequest, res: Response, next: NextFunction) => authImpl(req, res, next)
}));

import * as analyticsModule from '../../server/analytics-routes.ts';

const { registerAnalyticsRoutes, analyticsService } = analyticsModule;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  registerAnalyticsRoutes(app);
  return app;
}

describe('Analytics route authentication', () => {
  beforeEach(() => {
    authImpl = (_req, _res, next) => next();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated analytics requests', async () => {
    const analyticsSpy = vi.spyOn(analyticsService, 'getAnalyticsData');
    const app = createApp();

    const response = await request(app).get('/api/analytics/7d');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: 'Authentication required' });
    expect(analyticsSpy).not.toHaveBeenCalled();
  });

  it('returns content analytics for the authenticated user', async () => {
    authImpl = (req, _res, next) => {
      req.user = { id: 42 };
      next();
    };

    const getContentAnalyticsMock = vi
      .spyOn(analyticsService, 'getContentAnalytics')
      .mockResolvedValue({
        contentId: 55,
        totalViews: 3,
        uniqueViewers: 2,
        platformBreakdown: { instagram: 3 }
      });

    const app = createApp();
    const response = await request(app).get('/api/analytics/content/55');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      contentId: 55,
      totalViews: 3,
      uniqueViewers: 2,
      platformBreakdown: { instagram: 3 }
    });
    expect(getContentAnalyticsMock).toHaveBeenCalledWith(55, 42);
  });

  it('does not expose content analytics for other users', async () => {
    authImpl = (req, _res, next) => {
      req.user = { id: 42 };
      next();
    };

    const getContentAnalyticsMock = vi
      .spyOn(analyticsService, 'getContentAnalytics')
      .mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).get('/api/analytics/content/99');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Content not found' });
    expect(getContentAnalyticsMock).toHaveBeenCalledWith(99, 42);
  });
});