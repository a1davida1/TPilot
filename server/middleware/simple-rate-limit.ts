import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter - no Redis dependency
// Each limiter instance gets its own Map to prevent cross-contamination
export function simpleRateLimiter(windowMs = 900000, maxAttempts = 3) {
  const attemptStore = new Map<string, { count: number; resetTime: number }>(); // Unique Map per limiter instance
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.body?.email || req.ip;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of attemptStore.entries()) {
      if (v.resetTime < now) {
        attemptStore.delete(k);
      }
    }
    
    const record = attemptStore.get(key) || { 
      count: 0, 
      resetTime: now + windowMs 
    };
    
    if (record.resetTime < now) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    
    record.count++;
    attemptStore.set(key, record);
    
    if (record.count > maxAttempts) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter.toString());
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Please try again later.',
        retryAfter
      });
    }
    
    next();
  };
}

// Export specific limiters with enhanced configurations
export const verificationLimiter = simpleRateLimiter(15 * 60 * 1000, 3);  // 15 min, 3 attempts
export const passwordResetLimiter = simpleRateLimiter(60 * 60 * 1000, 5); // 1 hour, 5 attempts
export const loginLimiter = simpleRateLimiter(15 * 60 * 1000, 5);         // 15 min, 5 attempts
export const signupLimiter = simpleRateLimiter(60 * 60 * 1000, 3);        // 1 hour, 3 attempts

// Additional specialized rate limiters for enhanced security
export const passwordChangeLimiter = simpleRateLimiter(60 * 60 * 1000, 3); // 1 hour, 3 attempts
export const emailChangeLimiter = simpleRateLimiter(60 * 60 * 1000, 2);   // 1 hour, 2 attempts  
export const accountDeletionLimiter = simpleRateLimiter(24 * 60 * 60 * 1000, 1); // 24 hours, 1 attempt
export const twoFactorLimiter = simpleRateLimiter(5 * 60 * 1000, 10);     // 5 min, 10 attempts
export const refreshTokenLimiter = simpleRateLimiter(60 * 60 * 1000, 10); // 1 hour, 10 attempts
