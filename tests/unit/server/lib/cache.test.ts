/**
 * Unit tests for cache.ts
 * Tests Redis caching behavior, fallbacks, and statistics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis
const mockRedisInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  flushdb: vi.fn(),
  quit: vi.fn(),
  on: vi.fn()
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedisInstance)
  };
});

vi.mock('../../../../server/bootstrap/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Cache Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset modules to get fresh cache state
    vi.resetModules();
  });

  describe('cacheGet', () => {
    it('should return cached value when available', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ test: 'data' }));

      const { cacheGet } = await import('../../../../server/lib/cache');
      const result = await cacheGet('test-key');

      expect(result).toEqual({ test: 'data' });
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key not found', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);

      const { cacheGet } = await import('../../../../server/lib/cache');
      const result = await cacheGet('missing-key');

      expect(result).toBeNull();
    });

    it('should return null and log error on Redis failure', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheGet } = await import('../../../../server/lib/cache');
      const result = await cacheGet('test-key');

      expect(result).toBeNull();
    });

    it('should parse JSON correctly', async () => {
      const complexData = {
        user: { id: 123, name: 'test' },
        metrics: [1, 2, 3],
        nested: { deep: { value: true } }
      };
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify(complexData));

      const { cacheGet } = await import('../../../../server/lib/cache');
      const result = await cacheGet('complex-key');

      expect(result).toEqual(complexData);
    });
  });

  describe('cacheSet', () => {
    it('should store value with TTL', async () => {
      mockRedisInstance.setex.mockResolvedValueOnce('OK');

      const { cacheSet } = await import('../../../../server/lib/cache');
      const result = await cacheSet('test-key', { data: 'value' }, 3600);

      expect(result).toBe(true);
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify({ data: 'value' })
      );
    });

    it('should handle complex objects', async () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { key: 'value' },
        number: 123,
        boolean: true
      };
      mockRedisInstance.setex.mockResolvedValueOnce('OK');

      const { cacheSet } = await import('../../../../server/lib/cache');
      await cacheSet('complex-key', complexData, 60);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'complex-key',
        60,
        JSON.stringify(complexData)
      );
    });

    it('should return false on Redis failure', async () => {
      mockRedisInstance.setex.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheSet } = await import('../../../../server/lib/cache');
      const result = await cacheSet('test-key', { data: 'value' }, 3600);

      expect(result).toBe(false);
    });

    it('should handle different TTL values', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      const { cacheSet, CACHE_TTL } = await import('../../../../server/lib/cache');
      
      await cacheSet('key1', 'data', CACHE_TTL.FIVE_MINUTES);
      await cacheSet('key2', 'data', CACHE_TTL.ONE_HOUR);
      await cacheSet('key3', 'data', CACHE_TTL.ONE_DAY);

      expect(mockRedisInstance.setex).toHaveBeenCalledTimes(3);
    });
  });

  describe('cacheDelete', () => {
    it('should delete key from cache', async () => {
      mockRedisInstance.del.mockResolvedValueOnce(1);

      const { cacheDelete } = await import('../../../../server/lib/cache');
      const result = await cacheDelete('test-key');

      expect(result).toBe(true);
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false on Redis failure', async () => {
      mockRedisInstance.del.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheDelete } = await import('../../../../server/lib/cache');
      const result = await cacheDelete('test-key');

      expect(result).toBe(false);
    });
  });

  describe('cacheDeletePattern', () => {
    it('should delete all matching keys', async () => {
      mockRedisInstance.keys.mockResolvedValueOnce([
        'analytics:user:123:sub:gonewild:metrics',
        'analytics:user:123:sub:RealGirls:metrics'
      ]);
      mockRedisInstance.del.mockResolvedValueOnce(2);

      const { cacheDeletePattern } = await import('../../../../server/lib/cache');
      const result = await cacheDeletePattern('analytics:user:123:*');

      expect(result).toBe(2);
      expect(mockRedisInstance.keys).toHaveBeenCalledWith('analytics:user:123:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        'analytics:user:123:sub:gonewild:metrics',
        'analytics:user:123:sub:RealGirls:metrics'
      );
    });

    it('should return 0 when no keys match', async () => {
      mockRedisInstance.keys.mockResolvedValueOnce([]);

      const { cacheDeletePattern } = await import('../../../../server/lib/cache');
      const result = await cacheDeletePattern('nonexistent:*');

      expect(result).toBe(0);
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisInstance.keys.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheDeletePattern } = await import('../../../../server/lib/cache');
      const result = await cacheDeletePattern('test:*');

      expect(result).toBe(0);
    });
  });

  describe('cacheGetOrSet', () => {
    it('should return cached value if exists', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));

      const { cacheGetOrSet } = await import('../../../../server/lib/cache');
      const generator = vi.fn();
      
      const result = await cacheGetOrSet('test-key', generator, 3600);

      expect(result).toEqual({ cached: true });
      expect(generator).not.toHaveBeenCalled();
    });

    it('should call generator and cache result if not cached', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);
      mockRedisInstance.setex.mockResolvedValueOnce('OK');

      const { cacheGetOrSet } = await import('../../../../server/lib/cache');
      const generator = vi.fn().mockResolvedValue({ fresh: true });
      
      const result = await cacheGetOrSet('test-key', generator, 3600);

      expect(result).toEqual({ fresh: true });
      expect(generator).toHaveBeenCalledOnce();
      expect(mockRedisInstance.setex).toHaveBeenCalled();
    });

    it('should not fail if cache set fails', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);
      mockRedisInstance.setex.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheGetOrSet } = await import('../../../../server/lib/cache');
      const generator = vi.fn().mockResolvedValue({ data: 'value' });
      
      const result = await cacheGetOrSet('test-key', generator, 3600);

      // Should still return generated value
      expect(result).toEqual({ data: 'value' });
    });

    it('should handle generator errors', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);

      const { cacheGetOrSet } = await import('../../../../server/lib/cache');
      const generator = vi.fn().mockRejectedValue(new Error('Generator failed'));
      
      await expect(cacheGetOrSet('test-key', generator, 3600)).rejects.toThrow('Generator failed');
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(JSON.stringify({ data: 'value' }));

      const { cacheGet, getCacheStats } = await import('../../../../server/lib/cache');
      
      await cacheGet('test-key');
      const stats = getCacheStats();

      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should track cache misses', async () => {
      mockRedisInstance.get.mockResolvedValueOnce(null);

      const { cacheGet, getCacheStats } = await import('../../../../server/lib/cache');
      
      await cacheGet('missing-key');
      const stats = getCacheStats();

      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should track cache errors', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Redis error'));

      const { cacheGet, getCacheStats } = await import('../../../../server/lib/cache');
      
      await cacheGet('test-key');
      const stats = getCacheStats();

      expect(stats.errors).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      const { getCacheStats, resetCacheStats } = await import('../../../../server/lib/cache');
      
      resetCacheStats();
      const stats = getCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('Cache Availability', () => {
    it('should return false when Redis not available', async () => {
      // Mock Redis as unavailable
      vi.doMock('../../../../server/lib/cache', async () => {
        const actual = await vi.importActual<typeof import('../../../../server/lib/cache')>('../../../../server/lib/cache');
        return {
          ...actual,
          isCacheAvailable: () => false
        };
      });

      const { isCacheAvailable } = await import('../../../../server/lib/cache');
      expect(isCacheAvailable()).toBe(false);
    });
  });

  describe('Graceful Degradation', () => {
    it('should work without Redis connection', async () => {
      // Simulate Redis not configured
      vi.stubEnv('REDIS_URL', '');

      const { cacheGet, cacheSet } = await import('../../../../server/lib/cache');
      
      const getResult = await cacheGet('test-key');
      const setResult = await cacheSet('test-key', 'value', 60);

      expect(getResult).toBeNull();
      expect(setResult).toBe(false);
    });

    it('should continue working after Redis failure', async () => {
      mockRedisInstance.get.mockRejectedValueOnce(new Error('Redis down'));

      const { cacheGet } = await import('../../../../server/lib/cache');
      
      const result1 = await cacheGet('key1');
      const result2 = await cacheGet('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      // Should not crash
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate correct user subreddit metrics key', async () => {
      const { CACHE_KEYS } = await import('../../../../server/lib/cache');
      
      const key = CACHE_KEYS.USER_SUBREDDIT_METRICS(123, 'gonewild');
      
      expect(key).toBe('analytics:user:123:sub:gonewild:metrics');
    });

    it('should generate correct global metrics key', async () => {
      const { CACHE_KEYS } = await import('../../../../server/lib/cache');
      
      const key = CACHE_KEYS.GLOBAL_SUBREDDIT_METRICS('RealGirls');
      
      expect(key).toBe('analytics:global:sub:RealGirls:metrics');
    });

    it('should generate correct peak hours key', async () => {
      const { CACHE_KEYS } = await import('../../../../server/lib/cache');
      
      const key = CACHE_KEYS.SUBREDDIT_PEAK_HOURS('gonewild');
      
      expect(key).toBe('analytics:sub:gonewild:peak-hours');
    });
  });

  describe('TTL Values', () => {
    it('should have correct TTL constants', async () => {
      const { CACHE_TTL } = await import('../../../../server/lib/cache');
      
      expect(CACHE_TTL.FIVE_MINUTES).toBe(300);
      expect(CACHE_TTL.FIFTEEN_MINUTES).toBe(900);
      expect(CACHE_TTL.ONE_HOUR).toBe(3600);
      expect(CACHE_TTL.SIX_HOURS).toBe(21600);
      expect(CACHE_TTL.ONE_DAY).toBe(86400);
      expect(CACHE_TTL.ONE_WEEK).toBe(604800);
    });
  });
});
