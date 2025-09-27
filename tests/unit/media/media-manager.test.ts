import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

const mockConfig = vi.hoisted(() => ({
  mediaQuotas: {
    free: 500,
    pro: 5_000,
    premium: 10_000,
  },
  watermark: {
    enabled: false,
    text: 'Test',
    opacity: 0.5,
  },
  signedUrlTTL: 900,
}));

vi.mock('../../../server/db.js', () => ({
  db: mockDb,
}));

vi.mock('../../../server/lib/config.js', () => ({
  env: {
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    S3_BUCKET_MEDIA: '',
    S3_PUBLIC_CDN_DOMAIN: '',
    AWS_REGION: 'us-east-1',
    REDIS_URL: '',
  },
  config: mockConfig,
}));

describe('MediaManager.getUserStorageUsage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.select.mockReset();
  });

  it('returns configured free tier quota for free users', async () => {
    const { MediaManager } = await import('../../../server/lib/media.js');

    mockDb.select
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ totalBytes: 256 }]),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ tier: 'free' }]),
          }),
        }),
      }));

    const usage = await MediaManager.getUserStorageUsage(1);

    expect(usage).toEqual({ used: 256, quota: mockConfig.mediaQuotas.free });
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it('returns configured pro tier quota for pro users', async () => {
    const { MediaManager } = await import('../../../server/lib/media.js');

    mockDb.select
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => Promise.resolve([{ totalBytes: 1_024 }]),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ tier: 'pro' }]),
          }),
        }),
      }));

    const usage = await MediaManager.getUserStorageUsage(2);

    expect(usage).toEqual({ used: 1_024, quota: mockConfig.mediaQuotas.pro });
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});