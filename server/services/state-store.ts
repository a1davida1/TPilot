import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Memory-based state store (Redis can be added later if needed)
const memoryStore = new Map<string, { data: string; expires: number }>();

export const stateStore = {
  async set(key: string, value: unknown, expiresIn = 3600) {
    const data = JSON.stringify(value);
    memoryStore.set(key, { 
      data, 
      expires: Date.now() + (expiresIn * 1000) 
    });
  },
  
  async get(key: string) {
    const item = memoryStore.get(key);
    if (!item) return null;
    
    // Check if expired
    if (Date.now() > item.expires) {
      memoryStore.delete(key);
      return null;
    }
    
    return JSON.parse(item.data);
  },
  
  async delete(key: string) {
    memoryStore.delete(key);
  }
};

// Encryption utilities for tokens
const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'default-encryption-key-change-in-production';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')),
    iv
  );
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0')),
      iv
    );
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

// Rate limiting
const rateLimiter = new Map<string, number[]>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:reddit_oauth`;
  const now = Date.now();
  const attempts = rateLimiter.get(key) || [];
  
  // Clean old attempts (keep last minute)
  const recentAttempts = attempts.filter(t => now - t < 60000);
  
  if (recentAttempts.length >= 5) {
    return res.status(429).json({ error: 'Too many OAuth attempts. Please wait a minute.' });
  }
  
  recentAttempts.push(now);
  rateLimiter.set(key, recentAttempts);
  next();
}