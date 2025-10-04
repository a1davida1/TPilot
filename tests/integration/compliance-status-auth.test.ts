import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockUser = {
  id: number;
  role?: string | null;
  isAdmin?: boolean | null;
};

type AuthenticatedRequest = Request & {
  user?: MockUser;
  isAuthenticated?: () => boolean;
};

type AuthenticateTokenMock = ((
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void) & ((
  required?: boolean
) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void);

const mockUserState: { currentUser: MockUser | null } = { currentUser: null };

const createAuthenticateTokenMiddleware = (
  required: boolean
): ((req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void) => {
  return async (req, res, next) => {
    const user = mockUserState.currentUser;

    if (!user) {
      if (required) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      next();
      return;
    }

    req.user = user;
    req.isAuthenticated = (() => true) as any;
    next();
  };
};

const authenticateTokenImplementation: AuthenticateTokenMock = ((
  reqOrRequired: boolean | AuthenticatedRequest,
  res?: Response,
  next?: NextFunction
) => {
  if (typeof reqOrRequired === 'boolean') {
    return createAuthenticateTokenMiddleware(reqOrRequired);
  }

  if (!res || !next) {
    throw new Error('authenticateToken mock requires response and next arguments');
  }

  return createAuthenticateTokenMiddleware(true)(reqOrRequired, res, next);
}) as AuthenticateTokenMock;

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: authenticateTokenImplementation,
}));

import { complianceStatusRouter } from '../../server/api/compliance-status.ts';

function createApp() {
  const app = express();
  app.use('/api/admin/compliance', complianceStatusRouter);
  return app;
}

describe('Compliance status admin protection', () => {
  beforeEach(() => {
    mockUserState.currentUser = null;
  });

  it('rejects non-admin users with 403', async () => {
    mockUserState.currentUser = { id: 2, role: 'member', isAdmin: false };

    const app = createApp();
    const response = await request(app).get('/api/admin/compliance');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ message: 'Admin access required' });
  });

  it('allows admin users to access compliance status', async () => {
    mockUserState.currentUser = { id: 1, role: 'admin', isAdmin: true };

    const app = createApp();
    const response = await request(app).get('/api/admin/compliance');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'success' });
  });
});
