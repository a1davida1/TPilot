import jwt from 'jsonwebtoken';
import express from 'express';
import { logger } from './security.js';
import { db } from '../db.js';
import { users } from '@shared/schema.js';

import { eq } from 'drizzle-orm';

// Create a proper User type alias from the schema
type UserType = typeof users.$inferSelect;

export interface AuthRequest extends express.Request {
  user?: UserType;
}

// Get JWT secret (must be set in environment)
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Get admin credentials from environment (required)
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
}

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Fall back to JWT stored in httpOnly cookie
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
  }

  // Try JWT token first
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string; iat: number; exp: number };
      
      // Fetch the full user object from database
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
      
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
    req.user = (req.session as { user: UserType }).user;
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