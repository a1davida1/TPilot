import jwt from 'jsonwebtoken';
import express from 'express';
import { logger } from './security.js';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { isTokenBlacklisted } from '../lib/tokenBlacklist';
import { getAdminCredentials } from '../lib/admin-auth.js';

import { eq } from 'drizzle-orm';

const EMAIL_NOT_VERIFIED_RESPONSE = (
  res: express.Response,
  email: string
) => {
  if (typeof res.clearCookie === 'function') {
    res.clearCookie('authToken');
  }

  return res.status(403).json({
    message: 'Email not verified. Please check your email or resend verification.',
    code: 'EMAIL_NOT_VERIFIED',
    email
  });
};

const clearAuthTokenCookie = (res: express.Response) => {
  if (typeof res.clearCookie === 'function') {
    res.clearCookie('authToken');
  }
};

const respondWithStatus = <Body extends Record<string, unknown>>(
  res: express.Response,
  statusCode: number,
  body: Body
) : express.Response => {
  clearAuthTokenCookie(res);
  return res.status(statusCode).json(body);
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

export const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Fall back to JWT stored in httpOnly cookie
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
  }

  // Try JWT token first
  if (token) {
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number; id?: number; email?: string; isAdmin?: boolean; username?: string; role?: string; tier?: string; iat: number; exp: number };

      // All users must exist in database - no hardcoded admin backdoors
      // Admin status is verified from database isAdmin/role fields only

      // For regular users, fetch from database
      const userId = decoded.userId || decoded.id;
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token: missing user ID' });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
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
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Fallback to session-based auth
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

  return res.status(401).json({ error: 'Access token required' });
};

export const createToken = (user: UserType): string => {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): { userId: number; email: string; iat: number; exp: number } => {
  return jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
};