import jwt from 'jsonwebtoken';
import express from 'express';
import { logger } from './security.js';
import { db } from '../db.js';
import { users } from '@shared/schema';
import { isTokenBlacklisted } from '../lib/tokenBlacklist';
import { getAdminCredentials } from '../lib/admin-auth.js';

import { eq } from 'drizzle-orm';

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
      return res.status(401).json({ message: 'Token revoked' });
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number; id?: number; email?: string; isAdmin?: boolean; username?: string; role?: string; tier?: string; iat: number; exp: number };
      
      // Handle admin tokens specially (they don't exist in the database)
      if (decoded.id === 999 || decoded.isAdmin) {
        req.user = {
          id: 999,
          username: 'admin',
          email: ADMIN_EMAIL || 'admin@example.com',
          tier: 'admin',
          isAdmin: true,
          role: 'admin',
          emailVerified: true,
          password: '', // Not needed for admin
          isDeleted: false,
          mustChangePassword: false,
          createdAt: new Date(),
          updatedAt: new Date()
        } as UserType;
        return next();
      }
      
      // For regular users, fetch from database
      const userId = decoded.userId || decoded.id;
      if (!userId) {
        return res.status(401).json({ message: 'Invalid token: missing user ID' });
      }
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      req.user = user;
      return next();
    } catch (error) {
      logger.error('Auth error:', error);
      return res.status(403).json({ message: 'Invalid token' });
    }
  }

  // Fallback to session-based auth
  if (req.session && (req.session as { user?: UserType }).user) {
    req.user = (req.session as any).user as UserType;
    return next();
  }

  return res.status(401).json({ message: 'Access token required' });
};

export const createToken = (user: UserType): string => {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): { userId: number; email: string; iat: number; exp: number } => {
  return jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
};