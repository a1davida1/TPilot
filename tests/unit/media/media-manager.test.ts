import sharp from 'sharp';
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

vi.mock('../../../server/db.ts', () => ({
  db: mockDb,
}));

vi.mock('../../../server/lib/config.ts', () => ({
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
    const { MediaManager } = await import('../../../server/lib/media.ts');

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
    const { MediaManager } = await import('../../../server/lib/media.ts');

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

describe('MediaManager.processImage', () => {
  it('preserves transparency for PNG uploads', async () => {
    const { MediaManager } = await import('../../../server/lib/media.ts');

    const transparentPng = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await MediaManager.processImage(transparentPng, {
      applyWatermark: false,
      quality: 90,
    });

    expect(result.mime).toBe('image/png');
    expect(result.extension).toBe('png');

    const metadata = await sharp(result.buffer, { animated: true }).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.hasAlpha ?? false).toBe(true);
  });

  it('retains animation frames for GIF uploads', async () => {
    const { MediaManager } = await import('../../../server/lib/media.ts');

    const animatedGif = await sharp({
      create: {
        width: 1,
        height: 2,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from([0, 255, 0, 255]),
          raw: { width: 1, height: 1, channels: 4 },
          top: 1,
          left: 0,
        },
      ])
      .gif({
        loop: 0,
        delay: [100, 100],
      })
      .toBuffer();

    const result = await MediaManager.processImage(animatedGif, {
      applyWatermark: false,
      quality: 90,
    });

    expect(result.mime).toBe('image/gif');
    expect(result.extension).toBe('gif');

    const metadata = await sharp(result.buffer, { animated: true }).metadata();
    expect(metadata.format).toBe('gif');
    expect((metadata.pages ?? 1) > 1).toBe(true);
  });
});