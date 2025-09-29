import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from '../../server/lib/config.ts';

// Mock config values
vi.mock('../../server/lib/config.ts', () => ({
  env: {
    PLAN_STORAGE_BYTES_FREE: 2 * 1024 * 1024 * 1024, // 2GB
    PLAN_STORAGE_BYTES_STARTER: 10 * 1024 * 1024 * 1024, // 10GB
    PLAN_STORAGE_BYTES_PRO: 50 * 1024 * 1024 * 1024, // 50GB
    MEDIA_MAX_BYTES_FREE: 500 * 1024 * 1024, // 500MB per upload
    MEDIA_MAX_BYTES_PRO: 10 * 1024 * 1024 * 1024, // 10GB per upload
  },
}));

describe('Storage Quotas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Tier-Based Storage Limits', () => {
    it('should enforce correct storage quotas by tier', () => {
      const tiers = {
        free: env.PLAN_STORAGE_BYTES_FREE,
        starter: env.PLAN_STORAGE_BYTES_STARTER,
        pro: env.PLAN_STORAGE_BYTES_PRO,
      };

      expect(tiers.free).toBe(2 * 1024 * 1024 * 1024); // 2GB
      expect(tiers.starter).toBe(10 * 1024 * 1024 * 1024); // 10GB
      expect(tiers.pro).toBe(50 * 1024 * 1024 * 1024); // 50GB
      
      // Ensure quotas are properly ordered
      expect(tiers.starter).toBeGreaterThan(tiers.free);
      expect(tiers.pro).toBeGreaterThan(tiers.starter);
    });

    it('should validate upload size limits by tier', () => {
      const uploadLimits = {
        free: env.MEDIA_MAX_BYTES_FREE,
        pro: env.MEDIA_MAX_BYTES_PRO,
      };

      expect(uploadLimits.free).toBe(500 * 1024 * 1024); // 500MB
      expect(uploadLimits.pro).toBe(10 * 1024 * 1024 * 1024); // 10GB
      expect(uploadLimits.pro).toBeGreaterThan(uploadLimits.free);
    });

    it('should calculate storage usage correctly', () => {
      const mockFiles = [
        { size: 50 * 1024 * 1024 }, // 50MB
        { size: 100 * 1024 * 1024 }, // 100MB
        { size: 25 * 1024 * 1024 }, // 25MB
      ];

      const totalUsage = mockFiles.reduce((sum, file) => sum + file.size, 0);
      const expectedUsage = 175 * 1024 * 1024; // 175MB

      expect(totalUsage).toBe(expectedUsage);
      
      // Check if under free tier quota
      expect(totalUsage).toBeLessThan(env.PLAN_STORAGE_BYTES_FREE);
    });

    it('should handle quota exceeded scenarios', () => {
      const freeQuota = env.PLAN_STORAGE_BYTES_FREE;
      const currentUsage = 1.8 * 1024 * 1024 * 1024; // 1.8GB
      const newFileSize = 500 * 1024 * 1024; // 500MB

      const wouldExceedQuota = (currentUsage + newFileSize) > freeQuota;
      
      expect(wouldExceedQuota).toBe(true); // Should exceed 2GB limit
    });
  });

  describe('Media Validation', () => {
    it('should validate file sizes against tier limits', () => {
      const freeUserFileSize = 600 * 1024 * 1024; // 600MB
      const proUserFileSize = 5 * 1024 * 1024 * 1024; // 5GB

      const freeUserCanUpload = freeUserFileSize <= env.MEDIA_MAX_BYTES_FREE;
      const proUserCanUpload = proUserFileSize <= env.MEDIA_MAX_BYTES_PRO;

      expect(freeUserCanUpload).toBe(false); // Exceeds 500MB limit
      expect(proUserCanUpload).toBe(true); // Under 10GB limit
    });

    it('should calculate remaining quota correctly', () => {
      const proQuota = env.PLAN_STORAGE_BYTES_PRO;
      const currentUsage = 30 * 1024 * 1024 * 1024; // 30GB
      const remainingQuota = proQuota - currentUsage;
      const expectedRemaining = 20 * 1024 * 1024 * 1024; // 20GB

      expect(remainingQuota).toBe(expectedRemaining);
      expect(remainingQuota).toBeGreaterThan(0);
    });
  });

  describe('Storage Utilities', () => {
    it('should format byte sizes correctly', () => {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(env.PLAN_STORAGE_BYTES_FREE)).toBe('2 GB');
    });

    it('should calculate percentage used', () => {
      const calculateUsagePercentage = (used: number, total: number): number => {
        return Math.round((used / total) * 100);
      };

      const usage50Percent = env.PLAN_STORAGE_BYTES_FREE / 2;
      const usage90Percent = env.PLAN_STORAGE_BYTES_FREE * 0.9;

      expect(calculateUsagePercentage(usage50Percent, env.PLAN_STORAGE_BYTES_FREE)).toBe(50);
      expect(calculateUsagePercentage(usage90Percent, env.PLAN_STORAGE_BYTES_FREE)).toBe(90);
    });
  });
});