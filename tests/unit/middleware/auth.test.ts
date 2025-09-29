import type express from 'express';
import jwt from 'jsonwebtoken';
import { describe, beforeEach, afterAll, it, expect, vi } from 'vitest';

const dbWhereMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => {
  const db = {
    select: vi.fn(() => db),
    from: vi.fn(() => db),
    where: dbWhereMock,
  };

  return db;
});

vi.mock('../../../server/db.ts', () => ({
  db: dbMock,
}));

vi.mock('../../../server/lib/tokenBlacklist', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
};

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH || '$2b$10$w8Vsy1uZb3lROoN0YjvS8O3b0sKQ6n1kG9F7ZbWuoFkA1x/ZzOAVa';

const buildResponse = () => {
  const res: Partial<express.Response> = {};
  res.status = vi.fn(() => res as express.Response);
  res.json = vi.fn();
  res.clearCookie = vi.fn();
  return res as express.Response & {
    status: ReturnType<typeof vi.fn> & ((code: number) => express.Response);
    json: ReturnType<typeof vi.fn> & ((payload: unknown) => express.Response);
    clearCookie: ReturnType<typeof vi.fn> & ((name: string) => express.Response);
  };
};

let authenticateToken: typeof import('../../../server/middleware/auth.ts')['authenticateToken'];

const loadAuthenticateToken = async () => {
  vi.clearAllMocks();
  dbWhereMock.mockReset();

  ({ authenticateToken } = await import('../../../server/middleware/auth.ts'));
};

afterAll(() => {
  process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  process.env.ADMIN_EMAIL = originalEnv.ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD_HASH = originalEnv.ADMIN_PASSWORD_HASH;
});

describe('authenticateToken email verification', () => {
  beforeEach(async () => {
    await loadAuthenticateToken();
  });

  it('rejects JWT-authenticated users with unverified email and clears auth cookie', async () => {
    const token = jwt.sign({ userId: 42, email: 'unverified@example.com' }, process.env.JWT_SECRET as string);
    dbWhereMock.mockResolvedValue([
      {
        id: 42,
        email: 'unverified@example.com',
        emailVerified: false,
      },
    ]);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: { authToken: token },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);
    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email not verified. Please check your email or resend verification.',
      code: 'EMAIL_NOT_VERIFIED',
      email: 'unverified@example.com',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated users with unverified email', async () => {
    const req = {
      headers: {},
      session: {
        user: {
          id: 99,
          email: 'pending@example.com',
          emailVerified: false,
        },
      },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Email not verified. Please check your email or resend verification.',
      code: 'EMAIL_NOT_VERIFIED',
      email: 'pending@example.com',
    });
    expect(next).not.toHaveBeenCalled();
    expect(dbWhereMock).not.toHaveBeenCalled();
  });
});

describe('authenticateToken account restrictions', () => {
  beforeEach(async () => {
    await loadAuthenticateToken();
  });

  it('rejects JWT-authenticated users whose account is deleted', async () => {
    const token = jwt.sign({ userId: 7, email: 'deleted@example.com' }, process.env.JWT_SECRET as string);
    dbWhereMock.mockResolvedValue([
      {
        id: 7,
        email: 'deleted@example.com',
        emailVerified: true,
        isDeleted: true,
      },
    ]);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: { authToken: token },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account deleted' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects JWT-authenticated users who are banned', async () => {
    const token = jwt.sign({ userId: 8, email: 'banned@example.com' }, process.env.JWT_SECRET as string);
    const bannedAt = new Date();
    dbWhereMock.mockResolvedValue([
      {
        id: 8,
        email: 'banned@example.com',
        emailVerified: true,
        isDeleted: false,
        bannedAt,
      },
    ]);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: { authToken: token },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account banned' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects JWT-authenticated users who are suspended', async () => {
    const token = jwt.sign({ userId: 9, email: 'suspended@example.com' }, process.env.JWT_SECRET as string);
    const suspendedUntil = new Date(Date.now() + 60 * 60 * 1000);
    dbWhereMock.mockResolvedValue([
      {
        id: 9,
        email: 'suspended@example.com',
        emailVerified: true,
        isDeleted: false,
        bannedAt: null,
        suspendedUntil,
      },
    ]);

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: { authToken: token },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Account suspended',
      suspendedUntil,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated users whose account is deleted', async () => {
    const req = {
      headers: {},
      session: {
        user: {
          id: 11,
          email: 'deleted-session@example.com',
          emailVerified: true,
          isDeleted: true,
        },
      },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account deleted' });
    expect(next).not.toHaveBeenCalled();
    expect(dbWhereMock).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated users who are banned', async () => {
    const bannedAt = new Date();
    const req = {
      headers: {},
      session: {
        user: {
          id: 12,
          email: 'banned-session@example.com',
          emailVerified: true,
          isDeleted: false,
          bannedAt,
        },
      },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account banned' });
    expect(next).not.toHaveBeenCalled();
    expect(dbWhereMock).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated users who are suspended', async () => {
    const suspendedUntil = new Date(Date.now() + 30 * 60 * 1000);
    const req = {
      headers: {},
      session: {
        user: {
          id: 13,
          email: 'suspended-session@example.com',
          emailVerified: true,
          isDeleted: false,
          bannedAt: null,
          suspendedUntil,
        },
      },
    } as unknown as import('../../../server/middleware/auth.ts').AuthRequest;

    const res = buildResponse();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.clearCookie).toHaveBeenCalledWith('authToken');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Account suspended',
      suspendedUntil,
    });
    expect(next).not.toHaveBeenCalled();
    expect(dbWhereMock).not.toHaveBeenCalled();
  });
});