import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
// Rate limit configurations by tier
const rateLimitConfigs = {
  free: {
    windowMs: 60000, // 1 minute
    max: 10,
    message: "You've reached your free tier limit. Upgrade to Starter or Pro for more requests!"
  },
  starter: {
    windowMs: 60000,
    max: 50,
    message: "Rate limit reached. Please wait a moment before trying again."
  },
  pro: {
    windowMs: 60000,
    max: 500,
    message: "Rate limit reached. Please wait a moment before trying again."
  },
  admin: {
    windowMs: 60000,
    max: 10000,
    message: "Admin rate limit reached."
  }
};

// Feature-specific rate limits
const featureLimits = {
  contentGeneration: {
    free: { windowMs: 3600000, max: 5, message: "You've reached your free content generation limit. Upgrade to Starter or Pro for more!" }, // 5 per hour
    starter: { windowMs: 3600000, max: 25, message: "Content generation limit reached. Please wait before trying again." }, // 25 per hour
    pro: { windowMs: 3600000, max: 200, message: "Content generation limit reached. Please wait before trying again." }, // 200 per hour
    admin: { windowMs: 3600000, max: 10000, message: "Admin content generation limit reached." }
  },
  imageProtection: {
    free: { windowMs: 3600000, max: 3, message: "You've reached your free image protection limit. Upgrade to Starter or Pro for more!" }, // 3 per hour
    starter: { windowMs: 3600000, max: 15, message: "Image protection limit reached. Please wait before trying again." }, // 15 per hour
    pro: { windowMs: 3600000, max: 100, message: "Image protection limit reached. Please wait before trying again." }, // 100 per hour
    admin: { windowMs: 3600000, max: 10000, message: "Admin image protection limit reached." }
  },
  postScheduling: {
    free: { windowMs: 86400000, max: 5, message: "You've reached your free post scheduling limit. Upgrade to Starter or Pro for more!" }, // 5 per day
    starter: { windowMs: 86400000, max: 25, message: "Post scheduling limit reached. Please wait before trying again." }, // 25 per day
    pro: { windowMs: 86400000, max: 200, message: "Post scheduling limit reached. Please wait before trying again." }, // 200 per day
    admin: { windowMs: 86400000, max: 10000, message: "Admin post scheduling limit reached." }
  },
  apiAccess: {
    free: { windowMs: 3600000, max: 100, message: "You've reached your free API access limit. Upgrade to Starter or Pro for more!" }, // 100 per hour
    starter: { windowMs: 3600000, max: 500, message: "API access limit reached. Please wait before trying again." }, // 500 per hour
    pro: { windowMs: 3600000, max: 5000, message: "API access limit reached. Please wait before trying again." }, // 5000 per hour
    admin: { windowMs: 3600000, max: 100000, message: "Admin API access limit reached." }
  }
};

// Store for user tiers (in production, this would be in Redis)
const userTierCache = new Map<string, { tier: string; expires: number }>();

// Get user tier from database or cache
async function getUserTier(userId: string | number): Promise<string> {
  const userIdStr = String(userId);
  
  // Check cache first
  const cached = userTierCache.get(userIdStr);
  if (cached && cached.expires > Date.now()) {
    return cached.tier;
  }
  
  try {
    // Fetch from database
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, typeof userId === 'string' ? parseInt(userId) : userId))
      .limit(1);
    
    if (!user) return 'free';
    
    // Use the tier from the database, fallback to free if not set
    let tier = user.tier || 'free';
    
    // Admin users always get admin tier regardless of database tier
    if (user.isAdmin) {
      tier = 'admin';
    }
    
    // Cache for 5 minutes
    userTierCache.set(userIdStr, {
      tier,
      expires: Date.now() + 300000
    });
    
    return tier;
  } catch (error) {
    logger.error(...formatLogArgs('Error fetching user tier:', error));
    return 'free';
  }
}

// Create rate limiter based on user tier
export function createTieredRateLimiter(feature?: keyof typeof featureLimits) {
  const limiters = new Map<string, ReturnType<typeof rateLimit>>();
  
  return async (req: Request & { user?: unknown }, res: Response, next: NextFunction) => {
    // Get user ID from request
    const userId = (req.user as { id?: string | number })?.id ?? req.headers['x-user-id'] ?? 'anonymous';
    
    // Get user tier
    const tier = await getUserTier(String(userId));
    
    // Select appropriate limits
    const limits = feature && featureLimits[feature] 
      ? featureLimits[feature][tier as keyof typeof featureLimits['contentGeneration']]
      : rateLimitConfigs[tier as keyof typeof rateLimitConfigs];
    
    if (!limits) {
      // Default to free tier if tier not found
      const defaultLimits = feature && featureLimits[feature]
        ? featureLimits[feature].free
        : rateLimitConfigs.free;
      
      const limiter = rateLimit({
        ...defaultLimits,
        keyGenerator: (_req) => `${userId}_${tier}_${feature || 'general'}`,
        handler: (req, res) => {
          res.status(429).json({
            error: defaultLimits.message || 'Rate limit exceeded. Please wait before trying again.',
            tier,
            retryAfter: Math.ceil(defaultLimits.windowMs / 1000),
            upgradeUrl: '/pricing'
          });
        }
      });
      
      return limiter(req, res, next);
    }
    
    // Get or create limiter for this tier
    const key = `${tier}_${feature || 'general'}`;
    if (!limiters.has(key)) {
      limiters.set(key, rateLimit({
        ...limits,
        keyGenerator: (_req) => `${userId}_${tier}_${feature || 'general'}`,
        handler: (req, res) => {
          res.status(429).json({
            error: limits.message || 'Rate limit exceeded. Please wait before trying again.',
            tier,
            retryAfter: Math.ceil(limits.windowMs / 1000),
            upgradeUrl: tier === 'free' || tier === 'starter' ? '/pricing' : undefined
          });
        }
      }));
    }
    
    const limiter = limiters.get(key);
    if (limiter) {
      limiter(req, res, next);
    } else {
      next();
    }
  };
}

// Specific rate limiters for different features
export const contentGenerationLimiter = createTieredRateLimiter('contentGeneration');
export const imageProtectionLimiter = createTieredRateLimiter('imageProtection');
export const postSchedulingLimiter = createTieredRateLimiter('postScheduling');
export const apiAccessLimiter = createTieredRateLimiter('apiAccess');
export const generalTieredLimiter = createTieredRateLimiter();

// Middleware to track API usage for billing
export function trackApiUsage() {
  return async (req: Request & { user?: unknown }, res: Response, next: NextFunction) => {
    // Only track for authenticated users
    if (!req.user?.id) {
      return next();
    }
    
    // Track usage (in production, this would go to a metrics service)
    const _usage = {
      userId: req.user.id,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date(),
      responseStatus: res.statusCode
    };
    
    // Log usage for billing purposes
    if (process.env.NODE_ENV === 'production') {
      // await metricsService.trackUsage(usage);
    }
    
    next();
  };
}

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userTierCache.entries()) {
    if (value.expires < now) {
      userTierCache.delete(key);
    }
  }
}, 60000); // Clean up every minute