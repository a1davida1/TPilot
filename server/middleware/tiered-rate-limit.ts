import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Rate limit configurations by tier
const rateLimitConfigs = {
  free: {
    windowMs: 60000, // 1 minute
    max: 10,
    message: "You've reached your free tier limit. Upgrade to Pro for more requests!"
  },
  starter: {
    windowMs: 60000,
    max: 50,
    message: "Rate limit reached. Please wait a moment before trying again."
  },
  pro: {
    windowMs: 60000,
    max: 200,
    message: "Rate limit reached. Please wait a moment before trying again."
  },
  premium: {
    windowMs: 60000,
    max: 1000,
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
    free: { windowMs: 3600000, max: 5 }, // 5 per hour
    starter: { windowMs: 3600000, max: 25 }, // 25 per hour
    pro: { windowMs: 3600000, max: 100 }, // 100 per hour
    premium: { windowMs: 3600000, max: 500 }, // 500 per hour
    admin: { windowMs: 3600000, max: 10000 }
  },
  imageProtection: {
    free: { windowMs: 3600000, max: 3 }, // 3 per hour
    starter: { windowMs: 3600000, max: 15 }, // 15 per hour
    pro: { windowMs: 3600000, max: 50 }, // 50 per hour
    premium: { windowMs: 3600000, max: 200 }, // 200 per hour
    admin: { windowMs: 3600000, max: 10000 }
  },
  postScheduling: {
    free: { windowMs: 86400000, max: 5 }, // 5 per day
    starter: { windowMs: 86400000, max: 25 }, // 25 per day
    pro: { windowMs: 86400000, max: 100 }, // 100 per day
    premium: { windowMs: 86400000, max: 500 }, // 500 per day
    admin: { windowMs: 86400000, max: 10000 }
  },
  apiAccess: {
    free: { windowMs: 3600000, max: 100 }, // 100 per hour
    starter: { windowMs: 3600000, max: 500 }, // 500 per hour
    pro: { windowMs: 3600000, max: 2000 }, // 2000 per hour
    premium: { windowMs: 3600000, max: 10000 }, // 10000 per hour
    admin: { windowMs: 3600000, max: 100000 }
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
    
    // Determine tier based on user data
    let tier = 'free';
    if (user.isAdmin) {
      tier = 'admin';
    } else if (user.stripeSubscriptionId) {
      // In production, check subscription status
      tier = 'pro'; // Default to pro for subscribed users
    } else if (user.emailVerified) {
      tier = 'starter';
    }
    
    // Cache for 5 minutes
    userTierCache.set(userIdStr, {
      tier,
      expires: Date.now() + 300000
    });
    
    return tier;
  } catch (error) {
    console.error('Error fetching user tier:', error);
    return 'free';
  }
}

// Create rate limiter based on user tier
export function createTieredRateLimiter(feature?: keyof typeof featureLimits) {
  const limiters = new Map<string, any>();
  
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    // Get user ID from request
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    
    // Get user tier
    const tier = await getUserTier(userId);
    
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
        keyGenerator: (req) => `${userId}_${tier}_${feature || 'general'}`,
        handler: (req, res) => {
          res.status(429).json({
            error: defaultLimits.message,
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
        keyGenerator: (req) => `${userId}_${tier}_${feature || 'general'}`,
        handler: (req, res) => {
          res.status(429).json({
            error: limits.message,
            tier,
            retryAfter: Math.ceil(limits.windowMs / 1000),
            upgradeUrl: tier === 'free' || tier === 'starter' ? '/pricing' : undefined
          });
        }
      }));
    }
    
    const limiter = limiters.get(key);
    limiter(req, res, next);
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
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    // Only track for authenticated users
    if (!req.user?.id) {
      return next();
    }
    
    // Track usage (in production, this would go to a metrics service)
    const usage = {
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