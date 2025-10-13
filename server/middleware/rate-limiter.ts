/**
 * Advanced Rate Limiting Middleware for ThottoPilot
 * Implements tier-based limits, endpoint-specific rules, and abuse prevention
 */

import rateLimit, { type Options } from 'express-rate-limit';
// Redis disabled for beta
// import RedisStore from 'rate-limit-redis';
// import Redis from 'ioredis';
import { Request, Response } from 'express';
import { logger } from '../bootstrap/logger.js';
import { type AuthRequest } from './auth.js';

// Redis disabled for beta - using memory store
const redisClient = null;
logger.info('Using memory store for rate limiting (Redis disabled for beta)');

// Tier-based rate limits (requests per minute)
const TIER_LIMITS = {
  free: {
    default: 60,      // 1 per second
    posts: 3,         // 3 posts per day (checked differently)
    captions: 5,      // 5 captions per day
    api: 100,         // 100 API calls per minute
  },
  starter: {
    default: 120,     // 2 per second
    posts: 10,        // 10 posts per day
    captions: 50,     // 50 captions per day
    api: 200,         // 200 API calls per minute
  },
  pro: {
    default: 300,     // 5 per second
    posts: 100,       // 100 posts per day
    captions: 500,    // 500 captions per day
    api: 500,         // 500 API calls per minute
  },
  premium: {
    default: 600,     // 10 per second
    posts: 9999,      // Unlimited posts
    captions: 9999,   // Unlimited captions
    api: 1000,        // 1000 API calls per minute
  },
  admin: {
    default: 9999,    // No limit for admins
    posts: 9999,
    captions: 9999,
    api: 9999,
  }
};

// Get user tier from request
const getUserTier = (req: AuthRequest): keyof typeof TIER_LIMITS => {
  if (!req.user) return 'free';
  if (req.user.isAdmin) return 'admin';
  return (req.user.tier as keyof typeof TIER_LIMITS) || 'free';
};

// Custom key generator function that prioritizes authenticated user ID over IP
const keyGenerator = (req: Request): string => {
  const authReq = req as AuthRequest;
  if (authReq.user?.id) {
    return `user-${authReq.user.id}`;
  }
  // Use the built-in IP key generator for proper IPv6 support
  const { ipKeyGenerator } = require('express-rate-limit');
  return ipKeyGenerator(req);
};

// Create rate limiter with tier-based limits
const createRateLimiter = (
  endpoint: keyof typeof TIER_LIMITS.free,
  windowMs: number = 60000, // 1 minute default
  skipSuccessfulRequests: boolean = false
) => {
  const options: Partial<Options> = {
    windowMs,
    skipSuccessfulRequests,
    keyGenerator,
    handler: (req: Request, res: Response) => {
      const tier = getUserTier(req as AuthRequest);
      logger.warn('Rate limit exceeded', {
        endpoint,
        tier,
        user: (req as AuthRequest).user?.username || 'anonymous',
        ip: req.ip,
        path: req.path
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please wait before trying again.`,
        tier,
        limit: TIER_LIMITS[tier][endpoint],
        retryAfter: Math.ceil(windowMs / 1000) + ' seconds'
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      if (req.path === '/api/health' || req.path === '/api/health/live') {
        return true;
      }
      // Admin users bypass rate limits
      const authReq = req as AuthRequest;
      return authReq.user?.isAdmin === true;
    },
    max: (req: Request) => {
      const tier = getUserTier(req as AuthRequest);
      return TIER_LIMITS[tier][endpoint] || TIER_LIMITS[tier].default;
    }
  };

  // Using memory store for beta (Redis disabled)
  logger.info(`Rate limiter using memory store for ${endpoint}`);

  return rateLimit(options);
};

// Specific rate limiters for different endpoints
export const rateLimiters = {
  // General API rate limit (per minute)
  api: createRateLimiter('api', 60000),
  
  // Auth endpoints (stricter to prevent brute force)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    skipSuccessfulRequests: true,
    keyGenerator: (req) => req.ip || 'unknown',
    handler: (req, res) => {
      logger.error('Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      });
      res.status(429).json({
        error: 'Too many authentication attempts',
        message: 'Please wait 15 minutes before trying again',
        retryAfter: '15 minutes'
      });
    },
    // Memory store for beta (Redis disabled)
  }),
  
  // Reddit posting (daily limits based on tier)
  posting: createRateLimiter('posts', 24 * 60 * 60 * 1000), // 24 hour window
  
  // Caption generation (daily limits based on tier)
  captions: createRateLimiter('captions', 24 * 60 * 60 * 1000), // 24 hour window
  
  // File uploads (prevent abuse)
  upload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute max
    keyGenerator,
    handler: (req, res) => {
      logger.warn('Upload rate limit exceeded', {
        user: (req as AuthRequest).user?.username || 'anonymous',
        ip: req.ip
      });
      res.status(429).json({
        error: 'Upload limit exceeded',
        message: 'Please wait before uploading more files',
        retryAfter: '1 minute'
      });
    },
    // Memory store for beta
  }),

  // Feedback submission (prevent spam)
  feedback: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 feedback submissions per hour
    skipSuccessfulRequests: false,
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Feedback limit exceeded',
        message: 'Please wait before submitting more feedback',
        retryAfter: '1 hour'
      });
    },
    // Memory store for beta
  }),

  // Password reset (prevent abuse)
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 reset attempts per hour
    keyGenerator: (req) => req.body?.email || req.ip || 'unknown',
    handler: (req, res) => {
      logger.warn('Password reset rate limit exceeded', {
        email: req.body?.email,
        ip: req.ip
      });
      res.status(429).json({
        error: 'Too many password reset attempts',
        message: 'Please wait 1 hour before trying again',
        retryAfter: '1 hour'
      });
    },
    // Memory store for beta
  })
};

// Global rate limiter for all endpoints
export const globalRateLimiter = createRateLimiter('default', 60000);

// Abuse detection middleware
export const detectAbuse = (req: AuthRequest, res: Response, next: () => void) => {
  const suspicious = [
    // Multiple failed auth attempts
    req.path.includes('/auth') && res.statusCode === 401,
    // Rapid API calls from same IP
    (req as any).rateLimit?.remaining === 0,
    // Suspicious user agents
    req.headers['user-agent']?.includes('bot') && !req.headers['user-agent']?.includes('googlebot'),
  ].filter(Boolean).length;

  if (suspicious >= 2) {
    logger.warn('Suspicious activity detected', {
      user: req.user?.username || 'anonymous',
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent'],
      suspiciousFactors: suspicious
    });
  }

  next();
};

// Apply rate limiting to specific route groups
export const applyRateLimiting = (app: any) => {
  // Auth routes - strict limits
  app.use('/api/auth/login', rateLimiters.auth);
  app.use('/api/auth/signup', rateLimiters.auth);
  app.use('/api/auth/reset-password', rateLimiters.passwordReset);
  
  // Reddit posting - tier-based daily limits
  app.use('/api/reddit/submit', rateLimiters.posting);
  app.use('/api/scheduled-posts', rateLimiters.posting);
  
  // Caption generation - tier-based daily limits
  app.use('/api/caption/generate', rateLimiters.captions);
  app.use('/api/ai/generate', rateLimiters.captions);
  
  // File uploads - prevent abuse
  app.use('/api/upload', rateLimiters.upload);
  app.use('/api/uploads', rateLimiters.upload);
  
  // Feedback - prevent spam
  app.use('/api/feedback', rateLimiters.feedback);
  
  // Global rate limit for all other endpoints
  app.use('/api/', globalRateLimiter);
  
  // Abuse detection on all routes
  app.use(detectAbuse);
  
  logger.info('Rate limiting middleware configured', {
    redisAvailable: !!redisClient,
    endpoints: Object.keys(rateLimiters)
  });
};

export default {
  rateLimiters,
  globalRateLimiter,
  applyRateLimiting,
  detectAbuse
};
