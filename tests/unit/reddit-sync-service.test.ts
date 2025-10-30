/**
 * Unit Tests for Reddit Sync Service
 * Tests the three sync tiers: quick, deep, and full
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedditSyncService } from '../../server/services/reddit-sync-service.js';
import { HybridRedditClient } from '../../server/lib/reddit/hybrid-client.js';

// Mock dependencies
vi.mock('../../server/lib/reddit/hybrid-client.js');
vi.mock('../../server/db.js');
vi.mock('../../server/bootstrap/logger.js');

describe('RedditSyncService', () => {
  const mockUserId = 1;
  const mockUsername = 'testuser';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quickSync', () => {
    it('should sync 100 posts and top 10 subreddits', async () => {
      // Mock HybridRedditClient.forUser to return a mock client
      const mockClient = {
        getUserPosts: vi.fn().mockResolvedValue({
          posts: Array(100).fill(null).map((_, i) => ({
            id: `post_${i}`,
            title: `Post ${i}`,
            subreddit: `sub${i % 15}`, // 15 different subreddits
            author: mockUsername,
            score: Math.floor(Math.random() * 100),
            num_comments: Math.floor(Math.random() * 20),
            created_utc: Date.now() / 1000 - i * 3600,
            permalink: `/r/sub${i % 15}/comments/abc${i}`,
            url: `https://reddit.com/r/sub${i % 15}/comments/abc${i}`,
            is_self: true,
            over_18: false,
            removed_by_category: null,
          })),
          after: null,
        }),
        getSubredditInfo: vi.fn().mockResolvedValue({
          display_name: 'TestSub',
          title: 'Test Subreddit',
          public_description: 'A test subreddit',
          subscribers: 10000,
          active_user_count: 100,
          over18: false,
          subreddit_type: 'public',
          created_utc: Date.now() / 1000,
        }),
      };

      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(mockClient as any);

      const result = await RedditSyncService.quickSync(mockUserId, mockUsername);

      expect(result.status).toBe('completed');
      expect(result.postsSynced).toBe(100);
      expect(result.subredditsFound).toBeLessThanOrEqual(10);
      expect(result.canDeepSync).toBe(true); // Should allow deep sync if got 100 posts
      expect(mockClient.getUserPosts).toHaveBeenCalledWith(mockUsername, 100);
    });

    it('should handle no posts found', async () => {
      const mockClient = {
        getUserPosts: vi.fn().mockResolvedValue({
          posts: [],
          after: null,
        }),
      };

      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(mockClient as any);

      const result = await RedditSyncService.quickSync(mockUserId, mockUsername);

      expect(result.status).toBe('completed');
      expect(result.postsSynced).toBe(0);
      expect(result.subredditsFound).toBe(0);
      expect(result.canDeepSync).toBe(false);
    });

    it('should handle no active Reddit account', async () => {
      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(null);

      const result = await RedditSyncService.quickSync(mockUserId, mockUsername);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('No active Reddit account found');
      expect(result.postsSynced).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(HybridRedditClient.forUser).mockRejectedValue(
        new Error('Reddit API error')
      );

      const result = await RedditSyncService.quickSync(mockUserId, mockUsername);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Reddit API error');
    });
  });

  describe('deepSync', () => {
    it('should sync up to 500 posts with pagination', async () => {
      const mockClient = {
        getUserPosts: vi.fn()
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i, mockUsername)),
            after: 'page2',
          })
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i + 100, mockUsername)),
            after: 'page3',
          })
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i + 200, mockUsername)),
            after: 'page4',
          })
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i + 300, mockUsername)),
            after: 'page5',
          })
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i + 400, mockUsername)),
            after: null,
          }),
        getSubredditInfo: vi.fn().mockResolvedValue(createMockSubredditInfo()),
      };

      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(mockClient as any);

      const result = await RedditSyncService.deepSync(mockUserId, mockUsername);

      expect(result.status).toBe('completed');
      expect(result.postsSynced).toBe(500);
      expect(result.canDeepSync).toBe(true); // Got 500, can do full sync
      expect(mockClient.getUserPosts).toHaveBeenCalledTimes(5);
    });

    it('should stop pagination when no more posts', async () => {
      const mockClient = {
        getUserPosts: vi.fn()
          .mockResolvedValueOnce({
            posts: Array(100).fill(null).map((_, i) => createMockPost(i, mockUsername)),
            after: 'page2',
          })
          .mockResolvedValueOnce({
            posts: Array(50).fill(null).map((_, i) => createMockPost(i + 100, mockUsername)),
            after: null, // No more pages
          }),
        getSubredditInfo: vi.fn().mockResolvedValue(createMockSubredditInfo()),
      };

      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(mockClient as any);

      const result = await RedditSyncService.deepSync(mockUserId, mockUsername);

      expect(result.status).toBe('completed');
      expect(result.postsSynced).toBe(150);
      expect(result.canDeepSync).toBe(false); // Less than 500
      expect(mockClient.getUserPosts).toHaveBeenCalledTimes(2);
    });
  });

  describe('fullSync', () => {
    it('should require Premium tier', async () => {
      // Mock db.select to return non-premium user
      const { db } = await import('../../server/db.js');
      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ tier: 'pro' }]),
      });

      const result = await RedditSyncService.fullSync(mockUserId, mockUsername);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Full sync requires Premium tier');
    });

    it('should sync up to 1000 posts for Premium users', async () => {
      // Mock Premium user
      const { db } = await import('../../server/db.js');
      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ tier: 'premium' }]),
      });

      const mockClient = {
        getUserPosts: vi.fn()
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i, mockUsername)), after: 'p2' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 100, mockUsername)), after: 'p3' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 200, mockUsername)), after: 'p4' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 300, mockUsername)), after: 'p5' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 400, mockUsername)), after: 'p6' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 500, mockUsername)), after: 'p7' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 600, mockUsername)), after: 'p8' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 700, mockUsername)), after: 'p9' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 800, mockUsername)), after: 'p10' })
          .mockResolvedValueOnce({ posts: Array(100).fill(null).map((_, i) => createMockPost(i + 900, mockUsername)), after: null }),
        getSubredditInfo: vi.fn().mockResolvedValue(createMockSubredditInfo()),
      };

      vi.mocked(HybridRedditClient.forUser).mockResolvedValue(mockClient as any);

      const result = await RedditSyncService.fullSync(mockUserId, mockUsername);

      expect(result.status).toBe('completed');
      expect(result.postsSynced).toBe(1000);
      expect(result.canDeepSync).toBe(false); // Already did full sync
      expect(mockClient.getUserPosts).toHaveBeenCalledTimes(10);
    });
  });

  describe('getLastSyncStatus', () => {
    it('should return sync statistics', async () => {
      const { db } = await import('../../server/db.js');

      // Mock queries
      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          occurredAt: new Date('2024-01-15'),
        }]),
      });

      vi.mocked(db.selectDistinct as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { subreddit: 'sub1' },
          { subreddit: 'sub2' },
          { subreddit: 'sub3' },
        ]),
      });

      const result = await RedditSyncService.getLastSyncStatus(mockUserId);

      expect(result).not.toBeNull();
      expect(result?.lastSyncAt).toBeInstanceOf(Date);
      expect(result?.subredditCount).toBe(3);
    });

    it('should return null for users with no syncs', async () => {
      const { db } = await import('../../server/db.js');

      vi.mocked(db.select as any).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const result = await RedditSyncService.getLastSyncStatus(mockUserId);

      expect(result).toBeNull();
    });
  });
});

// Helper functions
function createMockPost(id: number, username: string) {
  return {
    id: `post_${id}`,
    title: `Post Title ${id}`,
    subreddit: `sub${id % 20}`,
    author: username,
    score: Math.floor(Math.random() * 100),
    num_comments: Math.floor(Math.random() * 20),
    created_utc: Date.now() / 1000 - id * 3600,
    permalink: `/r/sub${id % 20}/comments/abc${id}`,
    url: `https://reddit.com/r/sub${id % 20}/comments/abc${id}`,
    is_self: true,
    over_18: false,
    removed_by_category: null,
  };
}

function createMockSubredditInfo() {
  return {
    display_name: 'TestSub',
    title: 'Test Subreddit',
    public_description: 'A test subreddit',
    subscribers: 10000,
    active_user_count: 100,
    over18: false,
    subreddit_type: 'public',
    created_utc: Date.now() / 1000,
  };
}
