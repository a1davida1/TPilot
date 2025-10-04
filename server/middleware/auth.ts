import jwt from 'jsonwebtoken';
import express from 'express';
import { logger } from './security.js';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { isTokenBlacklisted } from '../lib/tokenBlacklist';
import { getAdminCredentials } from '../lib/admin-auth.js';
import { getCookieConfig } from '../utils/cookie-config.js';

import { eq } from 'drizzle-orm';

const EMAIL_NOT_VERIFIED_RESPONSE = (
  res: express.Response,
  email: string
) => {
  clearAuthTokenCookie(res);

  return res.status(403).json({
    message: 'Email not verified. Please check your email or resend verification.',
    code: 'EMAIL_NOT_VERIFIED',
    email
  });
};

const clearAuthTokenCookie = (res: express.Response) => {
  const cfg = getCookieConfig();
  // Clear with both sameSite values to handle both regular auth and OAuth cookies
  cfg.clear(res, cfg.authName); // Default (sameSite: lax)
  cfg.clear(res, cfg.authName, { ...cfg.options, sameSite: 'none' }); // OAuth (sameSite: none)
};

const respondWithStatus = <Body extends Record<string, unknown>>(
  res: express.Response,
  statusCode: number,
  body: Body
) : express.Response => {
  clearAuthTokenCookie(res);
  return res.status(statusCode).json(body);
};

const _parseBearerToken = (
  header: string | undefined
): { token: string | null; invalid: boolean } => {
  if (!header) {
    return { token: null, invalid: false };
  }

  const parts = header.trim().split(/\s+/u);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { token: null, invalid: true };
  }

  const token = parts[1]?.trim();
  if (!token) {
    return { token: null, invalid: true };
  }

  return { token, invalid: false };
};

const _normalizeTokenCandidate = (
  candidate: unknown
): { token: string | null; invalid: boolean } => {
  if (typeof candidate !== 'string') {
    return { token: null, invalid: false };
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return { token: null, invalid: true };
  }

  return { token: trimmed, invalid: false };
};

const _hasJwtStructure = (token: string): boolean => {
  const segments = token.split('.');
  return segments.length === 3 && segments.every(segment => segment.length > 0);
};

const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const handleAccountRestrictions = (
  user: UserType,
  res: express.Response
): express.Response | undefined => {
  if (user.isDeleted) {
    return respondWithStatus(res, 401, { error: 'Account deleted' });
  }

  const bannedAt = toDateOrNull(user.bannedAt);
  if (bannedAt) {
    return respondWithStatus(res, 403, { error: 'Account banned' });
  }

  const suspendedUntil = toDateOrNull(user.suspendedUntil);
  if (suspendedUntil && suspendedUntil.getTime() > Date.now()) {
    return respondWithStatus(res, 403, {
      error: 'Account suspended',
      suspendedUntil
    });
  }

  return undefined;
};

// Create a proper User type alias from the schema
type UserType = typeof users.$inferSelect;

export interface AuthRequest extends express.Request {
  user?: UserType;
}

// Get JWT secret (must be set in environment)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Get admin credentials from environment (required)
const adminCredentials = getAdminCredentials();

export const ADMIN_EMAIL = adminCredentials.email;
export const ADMIN_PASSWORD_HASH = adminCredentials.passwordHash;

if (!ADMIN_PASSWORD_HASH) {
  logger.warn('ADMIN_PASSWORD_HASH environment variable is not set. Admin login is disabled.');
}

if (!ADMIN_EMAIL) {
  logger.warn('ADMIN_EMAIL environment variable is not set. Admin login is disabled.');
}

// keep this (yours)
const isProd = process.env.NODE_ENV === 'production';
export const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
  path: '/',
};

type DecodedJwt = {
  userId?: number;
  id?: number;
  email?: string;
  isAdmin?: boolean;
  username?: string;
  role?: string;
  tier?: string;
  iat: number;
  exp: number;
};

type AuthMiddleware = (
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) => Promise<void | express.Response>;

const createAuthenticateTokenMiddleware = (required: boolean): AuthMiddleware => {
  return async (req, res, next) => {
    const rawAuthHeader = Array.isArray(req.headers['authorization'])
      ? req.headers['authorization'][0]
      : req.headers['authorization'];
    const { token: headerToken, invalid: headerInvalid } = _parseBearerToken(rawAuthHeader);

    if (headerInvalid) {
      return respondWithStatus(res, 401, { error: 'Invalid token' });
    }

    const cookieCandidate = _normalizeTokenCandidate(req.signedCookies?.authToken ?? req.cookies?.authToken);

    if (cookieCandidate.invalid) {
      return respondWithStatus(res, 401, { error: 'Invalid token' });
    }

    const token = headerToken ?? cookieCandidate.token;

    if (token) {
      if (!_hasJwtStructure(token)) {
        return respondWithStatus(res, 401, { error: 'Invalid token' });
      }

      if (await isTokenBlacklisted(token)) {
        clearAuthTokenCookie(res);
        if (required) {
          return res.status(401).json({ error: 'Token revoked' });
        }
        return next();
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as DecodedJwt;
        const userId = decoded.userId || decoded.id;

        if (!userId) {
          clearAuthTokenCookie(res);
          if (required) {
            return res.status(401).json({ error: 'Invalid token: missing user ID' });
          }
          return next();
        }

        const [user] = await db.select().from(users).where(eq(users.id, userId));

        if (!user) {
          clearAuthTokenCookie(res);
          if (required) {
            return res.status(401).json({ error: 'User not found' });
          }
          return next();
        }

        if (!user.emailVerified) {
          return EMAIL_NOT_VERIFIED_RESPONSE(res, user.email || '');
        }

        const restrictionResponse = handleAccountRestrictions(user, res);
        if (restrictionResponse) {
          return restrictionResponse;
        }

        req.user = user;
        return next();
      } catch (error) {
        logger.error('Auth error:', error);
        clearAuthTokenCookie(res);
        if (required) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return next();
      }
    }

    if (req.session && (req.session as { user?: UserType }).user) {
      const sessionUser = (req.session as { user?: UserType }).user as UserType;

      if (!sessionUser.emailVerified) {
        return EMAIL_NOT_VERIFIED_RESPONSE(res, sessionUser.email || '');
      }

      const restrictionResponse = handleAccountRestrictions(sessionUser, res);
      if (restrictionResponse) {
        return restrictionResponse;
      }

      req.user = sessionUser;
      return next();
    }

    if (required) {
      return res.status(401).json({ error: 'Access token required' });
    }

    return next();
  };
};

type AuthenticateToken = AuthMiddleware & ((required?: boolean) => AuthMiddleware);

export const authenticateToken: AuthenticateToken = ((
  reqOrRequired: boolean | AuthRequest,
  res?: express.Response,
  next?: express.NextFunction
) => {
  if (typeof reqOrRequired === 'boolean') {
    return createAuthenticateTokenMiddleware(reqOrRequired);
  }

  if (!res || !next) {
    throw new Error('authenticateToken middleware requires req, res, and next arguments');
  }

  return createAuthenticateTokenMiddleware(true)(reqOrRequired, res, next);
}) as AuthenticateToken;

export const createToken = (user: UserType): string => {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): { userId: number; email: string; iat: number; exp: number } => {
  return jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
};