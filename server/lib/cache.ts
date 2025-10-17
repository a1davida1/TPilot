/**
 * Redis Cache Layer for Analytics and Performance Optimization
 * 
 * Provides caching utilities for frequently-accessed data to reduce database load.
 * Falls back gracefully when Redis is unavailable.
 */

import Redis from 'ioredis';
import { logger } from '../bootstrap/logger.js';

let redis: Redis | null = null;
let isRedisAvailable = false;

// Initialize Redis connection if available
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed after 3 retries, disabling cache');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000); // Exponential backoff up to 3s
      }
    });

    redis.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Redis cache connected');
    });

    redis.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn('Redis cache error, falling back to no-cache mode', { error: err.message });
    });

    redis.on('close', () => {
      isRedisAvailable = false;
      logger.warn('Redis cache connection closed');
    });

    // Attempt to connect
    redis.connect().catch((err) => {
      logger.warn('Failed to connect to Redis cache', { error: err.message });
      isRedisAvailable = false;
    });
  } catch (error) {
    logger.warn('Failed to initialize Redis cache', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    redis = null;
  }
} else {
  logger.info('REDIS_URL not configured, cache disabled');
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  isAvailable: boolean;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  isAvailable: false
};

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return {
    ...stats,
    isAvailable: isRedisAvailable
  };
}

/**
 * Reset cache statistics (useful for testing)
 */
export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
}

/**
 * Check if Redis cache is available
 */
export function isCacheAvailable(): boolean {
  return isRedisAvailable && redis !== null;
}

/**
 * Get a value from cache
 * 
 * @param key Cache key
 * @returns Cached value or null if not found/error
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isCacheAvailable() || !redis) {
    stats.misses++;
    return null;
  }

  try {
    const value = await redis.get(key);
    if (value === null) {
      stats.misses++;
      return null;
    }

    stats.hits++;
    return JSON.parse(value) as T;
  } catch (error) {
    stats.errors++;
    logger.warn('Cache get error', { 
      key, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return null;
  }
}

/**
 * Set a value in cache with TTL
 * 
 * @param key Cache key
 * @param value Value to cache
 * @param ttlSeconds Time-to-live in seconds
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttlSeconds: number
): Promise<boolean> {
  if (!isCacheAvailable() || !redis) {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    stats.errors++;
    logger.warn('Cache set error', { 
      key, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Delete a key from cache
 * 
 * @param key Cache key
 */
export async function cacheDelete(key: string): Promise<boolean> {
  if (!isCacheAvailable() || !redis) {
    return false;
  }

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    stats.errors++;
    logger.warn('Cache delete error', { 
      key, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Delete multiple keys matching a pattern
 * 
 * @param pattern Key pattern (e.g., 'user:123:*')
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  if (!isCacheAvailable() || !redis) {
    return 0;
  }

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    stats.errors++;
    logger.warn('Cache delete pattern error', { 
      pattern, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return 0;
  }
}

/**
 * Get or set a value with a generator function
 * 
 * This is the primary caching pattern:
 * 1. Try to get from cache
 * 2. If not found, call generator function
 * 3. Cache the result
 * 4. Return the value
 * 
 * @param key Cache key
 * @param generator Function to generate value if not cached
 * @param ttlSeconds Time-to-live in seconds
 */
export async function cacheGetOrSet<T>(
  key: string,
  generator: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Generate value
  const value = await generator();

  // Cache it (fire and forget, don't block on cache failures)
  cacheSet(key, value, ttlSeconds).catch((error) => {
    logger.warn('Background cache set failed', { 
      key, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  });

  return value;
}

/**
 * Flush all keys from cache (use with caution)
 */
export async function cacheFlushAll(): Promise<boolean> {
  if (!isCacheAvailable() || !redis) {
    return false;
  }

  try {
    await redis.flushdb();
    logger.info('Cache flushed');
    return true;
  } catch (error) {
    stats.errors++;
    logger.error('Cache flush error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeCacheConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    isRedisAvailable = false;
    logger.info('Redis cache connection closed');
  }
}

/**
 * Common cache key prefixes for organization
 */
export const CACHE_KEYS = {
  // Analytics caching (1 hour TTL)
  USER_SUBREDDIT_METRICS: (userId: number, subreddit: string) => 
    `analytics:user:${userId}:sub:${subreddit}:metrics`,
  GLOBAL_SUBREDDIT_METRICS: (subreddit: string) => 
    `analytics:global:sub:${subreddit}:metrics`,
  SUBREDDIT_PEAK_HOURS: (subreddit: string) => 
    `analytics:sub:${subreddit}:peak-hours`,
  
  // Schedule optimization (1 hour TTL)
  OPTIMAL_SCHEDULE: (userId: number, subreddit: string) => 
    `schedule:user:${userId}:sub:${subreddit}:optimal`,
  
  // Reddit community data (6 hours TTL)
  COMMUNITY_RULES: (subreddit: string) => 
    `reddit:community:${subreddit}:rules`,
  COMMUNITY_INFO: (subreddit: string) => 
    `reddit:community:${subreddit}:info`,
  
  // User data (shorter TTL, 15 minutes)
  USER_REDDIT_ACCOUNT: (userId: number) => 
    `user:${userId}:reddit:account`,
  USER_TIER_LIMITS: (userId: number) => 
    `user:${userId}:tier:limits`,
} as const;

/**
 * Common TTL values (in seconds)
 */
export const CACHE_TTL = {
  FIVE_MINUTES: 5 * 60,
  FIFTEEN_MINUTES: 15 * 60,
  ONE_HOUR: 60 * 60,
  SIX_HOURS: 6 * 60 * 60,
  ONE_DAY: 24 * 60 * 60,
  ONE_WEEK: 7 * 24 * 60 * 60,
} as const;
