import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedditNativeUploadService } from '../../server/services/reddit-native-upload.js';
import { RedditManager } from '../../server/lib/reddit.js';
import { MediaManager } from '../../server/lib/media.js';

vi.mock('../../server/lib/reddit.js', () => ({
  RedditManager: {
    forUser: vi.fn(),
    canPostToSubreddit: vi.fn(),
  }
}));

vi.mock('../../server/lib/media.js', () => ({
  MediaManager: {
    getAsset: vi.fn(),
    getAssetBuffer: vi.fn(),
    recordUsage: vi.fn(),
  }
}));


vi.mock('../../server/compliance/ruleViolationTracker.js', () => ({
  recordPostOutcome: vi.fn(),
}));

vi.mock('../../server/routes/upload.js', () => ({
  applyImageShieldProtection: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: 'jpeg',
    }),
    toFile: vi.fn().mockResolvedValue({}),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('optimized-image')),
  })),
}));

vi.mock('fs/promises', () => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/test-dir'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('watermarked-image')),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}));

describe('RedditNativeUploadService', () => {
  const mockUserId = 123;
  const mockAssetId = 456;
  const mockSubreddit = 'test_subreddit';
  const mockTitle = 'Test Image Post';
  
  let mockRedditManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Reddit manager instance
    mockRedditManager = {
      submitImagePost: vi.fn(),
      submitPost: vi.fn(),
    };
    
    vi.mocked(RedditManager.forUser).mockResolvedValue(mockRedditManager);
    vi.mocked(RedditManager.canPostToSubreddit).mockResolvedValue({
      canPost: true,
      warnings: [],
      reasons: [],
      evaluatedAt: new Date(),
      postsInLast24h: 0,
      maxPostsPer24h: 1,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should upload image directly to Reddit without external hosting', async () => {
    // Mock media asset
    const mockAsset = {
      id: mockAssetId,
      key: 'test-key',
      filename: 'test.jpg',
      mime: 'image/jpeg',
      bytes: 1024,
      visibility: 'private',
    };
    
    // Create a minimal valid JPEG buffer
    const mockImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG SOI and APP0 marker
      0x00, 0x10, // Length
      0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
      0x01, 0x01, // Version
      0x00, // Aspect ratio units
      0x00, 0x01, // X density
      0x00, 0x01, // Y density
      0x00, 0x00, // Thumbnail dimensions
      0xFF, 0xD9, // EOI marker
    ]);
    
    vi.mocked(MediaManager.getAsset).mockResolvedValue(mockAsset as any);
    vi.mocked(MediaManager.getAssetBuffer).mockResolvedValue(mockImageBuffer);
    
    // Mock successful Reddit upload
    mockRedditManager.submitImagePost.mockResolvedValue({
      success: true,
      postId: 'abc123',
      url: 'https://www.reddit.com/r/test_subreddit/comments/abc123/',
      redditImageUrl: 'https://i.redd.it/abc123.jpg',
    });
    
    // Perform upload
    const result = await RedditNativeUploadService.uploadAndPost({
      userId: mockUserId,
      assetId: mockAssetId,
      subreddit: mockSubreddit,
      title: mockTitle,
      nsfw: false,
      spoiler: false,
      applyWatermark: false,
    });
    
    // Assertions
    expect(result.success).toBe(true);
    expect(result.postId).toBe('abc123');
    expect(result.url).toBe('https://www.reddit.com/r/test_subreddit/comments/abc123/');
    
    // Verify Reddit upload was called (don't check exact buffer due to optimization)
    expect(mockRedditManager.submitImagePost).toHaveBeenCalledTimes(1);
    expect(mockRedditManager.submitImagePost).toHaveBeenCalledWith(
      expect.objectContaining({
        subreddit: mockSubreddit,
        title: mockTitle,
        nsfw: false,
        spoiler: false,
      })
    );
    
    // Verify usage was recorded
    expect(MediaManager.recordUsage).toHaveBeenCalledWith(
      mockAssetId,
      'reddit-direct',
      expect.any(String)
    );
  });



  it('propagates Reddit upload failures without Catbox fallback', async () => {
    const mockAsset = {
      id: mockAssetId,
      key: 'test-key',
      filename: 'test.jpg',
      mime: 'image/jpeg',
      bytes: 1024,
      visibility: 'private',
    };

    const mockImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG SOI and APP0 marker
      0x00, 0x10, // Length
      0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
      0x01, 0x01, // Version
      0x00, // Aspect ratio units
      0x00, 0x01, // X density
      0x00, 0x01, // Y density
      0x00, 0x00, // Thumbnail dimensions
      0xFF, 0xD9, // EOI marker
    ]);

    vi.mocked(MediaManager.getAsset).mockResolvedValue(mockAsset as any);
    vi.mocked(MediaManager.getAssetBuffer).mockResolvedValue(mockImageBuffer);

    mockRedditManager.submitImagePost.mockResolvedValue({
      success: false,
      error: 'Reddit rate limit exceeded',
    });

    const result = await RedditNativeUploadService.uploadAndPost({
      userId: mockUserId,
      assetId: mockAssetId,
      subreddit: mockSubreddit,
      title: mockTitle,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Reddit rate limit exceeded');
    expect(result.postId).toBeUndefined();
    expect(MediaManager.recordUsage).not.toHaveBeenCalled();
    expect(mockRedditManager.submitPost).not.toHaveBeenCalled();
  });

  it.skip('should apply watermark when requested', async () => {
    const { applyImageShieldProtection } = await import('../../server/routes/upload.js');
    
    const mockAsset = {
      id: mockAssetId,
      key: 'test-key',
      filename: 'test.jpg',
      mime: 'image/jpeg',
      bytes: 1024,
      visibility: 'private',
    };
    
    // Create a minimal valid JPEG buffer
    const mockImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG SOI and APP0 marker
      0x00, 0x10, // Length
      0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF identifier
      0x01, 0x01, // Version
      0x00, // Aspect ratio units
      0x00, 0x01, // X density
      0x00, 0x01, // Y density
      0x00, 0x00, // Thumbnail dimensions
      0xFF, 0xD9, // EOI marker
    ]);
    
    vi.mocked(MediaManager.getAsset).mockResolvedValue(mockAsset as any);
    vi.mocked(MediaManager.getAssetBuffer).mockResolvedValue(mockImageBuffer);
    vi.mocked(applyImageShieldProtection).mockImplementation(async () => {
      // Simulate watermarking by writing to the output path
      return Promise.resolve();
    });
    
    mockRedditManager.submitImagePost.mockResolvedValue({
      success: true,
      postId: 'watermarked123',
      url: 'https://www.reddit.com/r/test_subreddit/comments/watermarked123/',
    });
    
    // Perform upload with watermark
    const result = await RedditNativeUploadService.uploadAndPost({
      userId: mockUserId,
      assetId: mockAssetId,
      subreddit: mockSubreddit,
      title: mockTitle,
      applyWatermark: true,
    });
    
    // Verify watermark was applied
    expect(applyImageShieldProtection).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should handle missing Reddit account gracefully', async () => {
    vi.mocked(RedditManager.forUser).mockResolvedValue(null);
    
    const result = await RedditNativeUploadService.uploadAndPost({
      userId: mockUserId,
      assetId: mockAssetId,
      subreddit: mockSubreddit,
      title: mockTitle,
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('No active Reddit account found. Please connect your Reddit account first.');
  });

  it('should handle subreddit posting restrictions', async () => {
    vi.mocked(RedditManager.canPostToSubreddit).mockResolvedValue({
      canPost: false,
      reason: 'You must have at least 100 karma to post in this subreddit',
      warnings: ['Low karma'],
      reasons: ['karma_requirement'],
      evaluatedAt: new Date(),
      postsInLast24h: 0,
      maxPostsPer24h: 1,
    } as any);
    
    const mockAsset = {
      id: mockAssetId,
      key: 'test-key',
      filename: 'test.jpg',
      mime: 'image/jpeg',
      bytes: 1024,
      visibility: 'private',
    };
    
    vi.mocked(MediaManager.getAsset).mockResolvedValue(mockAsset as any);
    
    const result = await RedditNativeUploadService.uploadAndPost({
      userId: mockUserId,
      assetId: mockAssetId,
      subreddit: mockSubreddit,
      title: mockTitle,
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('You must have at least 100 karma to post in this subreddit');
    expect(result.warnings).toEqual(['Low karma']);
  });
});
