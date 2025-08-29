import jwt from 'jsonwebtoken';
import express from 'express';
import { logger } from './security.js';

interface AuthRequest extends express.Request {
  user?: any;
}

// Get JWT secret (must be set in environment)
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Get admin credentials from environment (optional for demo)
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  Using default admin credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD in production!');
}

export const authenticateToken = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Auth error:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export const createToken = (payload: any): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};