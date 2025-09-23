import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedditManager } from '../../../server/lib/reddit.js';
import type { ShadowbanCheckApiResponse } from '@shared/schema';

// Test interfaces
interface MockSubmission {
  id: string;
  created_utc: number;
  permalink: string;
  title: string;
  subreddit: { display_name: string };
}

interface MockRedditUser {
  getSubmissions: () => Promise<MockSubmission[]>;
}

interface MockRedditClient {
  getMe: () => Promise<MockRedditUser>;
}

// Mock snoowrap
const mockReddit = {
  getMe: vi.fn(),
};

// Mock fetch for public Reddit API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock RedditManager.forUser to return our test instance
vi.mock('../../../server/lib/reddit.js', async () => {
  const actual = await vi.importActual('../../../server/lib/reddit.js') as Record<string, unknown>;
  return {
    ...actual,
    RedditManager: {
      ...((actual.RedditManager as Record<string, unknown>) || {}),
      forUser: vi.fn(),
    },
  };
});

describe('RedditManager shadowban detection', () => {
  let manager: RedditManager;
  const testUserId = 123;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a test instance with mocked reddit client
    manager = new (RedditManager as unknown as new (userId: number, client: MockRedditClient) => RedditManager)(testUserId, mockReddit);
    
    // Mock the getProfile method
    vi.spyOn(manager, 'getProfile').mockResolvedValue({
      username: 'testuser',
      karma: 1000,
      verified: false,
      createdUtc: 1577836800, // 2020-01-01T00:00:00Z in Unix timestamp
      goldStatus: false,
      hasMail: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkShadowbanStatus', () => {
    it('should return clear status when all submissions are publicly visible', async () => {
      // Mock private submissions (what user sees)
      const privateSubmissions = [
        {
          id: 'abc123',
          created_utc: 1640995200,
          permalink: '/r/test/comments/abc123/test_post/',
          title: 'Test Post 1',
          subreddit: { display_name: 'test' }
        },
        {
          id: 'def456',
          created_utc: 1640995100,
          permalink: '/r/test/comments/def456/test_post_2/',
          title: 'Test Post 2',
          subreddit: { display_name: 'test' }
        }
      ];

      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue(privateSubmissions)
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock public submissions (what Reddit's public API returns)
      const publicApiResponse = {
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                created_utc: 1640995200,
                permalink: '/r/test/comments/abc123/test_post/',
                title: 'Test Post 1',
                subreddit: 'test'
              }
            },
            {
              data: {
                id: 'def456',
                created_utc: 1640995100,
                permalink: '/r/test/comments/def456/test_post_2/',
                title: 'Test Post 2',
                subreddit: 'test'
              }
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(publicApiResponse)
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('clear');
      expect(result.reason).toContain('All recent submissions are publicly visible');
      expect(result.evidence.privateCount).toBe(2);
      expect(result.evidence.publicCount).toBe(2);
      expect(result.evidence.missingSubmissionIds).toHaveLength(0);
      expect(result.evidence.username).toBe('testuser');
    });

    it('should return suspected status when all submissions are missing from public view', async () => {
      // Mock private submissions
      const privateSubmissions = [
        {
          id: 'abc123',
          created_utc: 1640995200,
          permalink: '/r/test/comments/abc123/test_post/',
          title: 'Test Post 1',
          subreddit: { display_name: 'test' }
        },
        {
          id: 'def456',
          created_utc: 1640995100,
          permalink: '/r/test/comments/def456/test_post_2/',
          title: 'Test Post 2',
          subreddit: { display_name: 'test' }
        }
      ];

      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue(privateSubmissions)
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock empty public API response (all posts hidden)
      const publicApiResponse = {
        data: {
          children: []
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(publicApiResponse)
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('suspected');
      expect(result.reason).toContain('All recent submissions are missing from public view');
      expect(result.evidence.privateCount).toBe(2);
      expect(result.evidence.publicCount).toBe(0);
      expect(result.evidence.missingSubmissionIds).toHaveLength(2);
      expect(result.evidence.missingSubmissionIds).toContain('abc123');
      expect(result.evidence.missingSubmissionIds).toContain('def456');
    });

    it('should return suspected status when majority of submissions are missing', async () => {
      // Mock private submissions
      const privateSubmissions = [
        {
          id: 'abc123',
          created_utc: 1640995200,
          permalink: '/r/test/comments/abc123/test_post/',
          title: 'Test Post 1',
          subreddit: { display_name: 'test' }
        },
        {
          id: 'def456',
          created_utc: 1640995100,
          permalink: '/r/test/comments/def456/test_post_2/',
          title: 'Test Post 2',
          subreddit: { display_name: 'test' }
        },
        {
          id: 'ghi789',
          created_utc: 1640995000,
          permalink: '/r/test/comments/ghi789/test_post_3/',
          title: 'Test Post 3',
          subreddit: { display_name: 'test' }
        }
      ];

      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue(privateSubmissions)
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock public API response with only 1 of 3 posts visible
      const publicApiResponse = {
        data: {
          children: [
            {
              data: {
                id: 'abc123',
                created_utc: 1640995200,
                permalink: '/r/test/comments/abc123/test_post/',
                title: 'Test Post 1',
                subreddit: 'test'
              }
            }
          ]
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(publicApiResponse)
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('suspected');
      expect(result.reason).toContain('2 of 3 recent submissions are missing from public view');
      expect(result.evidence.privateCount).toBe(3);
      expect(result.evidence.publicCount).toBe(1);
      expect(result.evidence.missingSubmissionIds).toHaveLength(2);
      expect(result.evidence.missingSubmissionIds).toContain('def456');
      expect(result.evidence.missingSubmissionIds).toContain('ghi789');
    });

    it('should return unknown status when no recent submissions found', async () => {
      // Mock empty private submissions
      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue([])
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock empty public API response
      const publicApiResponse = {
        data: {
          children: []
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(publicApiResponse)
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('unknown');
      expect(result.reason).toContain('No recent submissions found to analyze');
      expect(result.evidence.privateCount).toBe(0);
      expect(result.evidence.publicCount).toBe(0);
      expect(result.evidence.missingSubmissionIds).toHaveLength(0);
    });

    it('should handle Reddit API errors gracefully', async () => {
      // Mock Reddit API failure
      mockReddit.getMe.mockRejectedValue(new Error('Reddit API error'));

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('unknown');
      expect(result.reason).toContain('Reddit API error');
      expect(result.evidence.privateCount).toBe(0);
      expect(result.evidence.publicCount).toBe(0);
    });

    it('should handle public API fetch errors gracefully', async () => {
      // Mock successful private submissions
      const privateSubmissions = [
        {
          id: 'abc123',
          created_utc: 1640995200,
          permalink: '/r/test/comments/abc123/test_post/',
          title: 'Test Post 1',
          subreddit: { display_name: 'test' }
        }
      ];

      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue(privateSubmissions)
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock public API failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('unknown');
      expect(result.reason).toContain('Reddit API returned 500: Internal Server Error');
      expect(result.evidence.privateCount).toBe(1);
      expect(result.evidence.publicCount).toBe(0);
    });

    it('should handle profile fetch errors', async () => {
      // Mock getProfile failure
      vi.spyOn(manager, 'getProfile').mockResolvedValue(null);

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('unknown');
      expect(result.reason).toContain('Unable to fetch Reddit profile for shadowban check');
    });

    it('should return clear status when few submissions are missing (under threshold)', async () => {
      // Mock private submissions (5 total)
      const privateSubmissions = Array.from({ length: 5 }, (_, i) => ({
        id: `post${i}`,
        created_utc: 1640995200 - i * 100,
        permalink: `/r/test/comments/post${i}/test_post_${i}/`,
        title: `Test Post ${i}`,
        subreddit: { display_name: 'test' }
      }));

      const mockUser = {
        getSubmissions: vi.fn().mockResolvedValue(privateSubmissions)
      };
      mockReddit.getMe.mockResolvedValue(mockUser);

      // Mock public API response with 4 of 5 posts visible (only 1 missing = 20%, under 50% threshold)
      const publicApiResponse = {
        data: {
          children: privateSubmissions.slice(0, 4).map(sub => ({
            data: {
              id: sub.id,
              created_utc: sub.created_utc,
              permalink: sub.permalink,
              title: sub.title,
              subreddit: sub.subreddit.display_name
            }
          }))
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(publicApiResponse)
      });

      const result: ShadowbanCheckApiResponse = await manager.checkShadowbanStatus();

      expect(result.status).toBe('clear');
      expect(result.reason).toContain('Most submissions are publicly visible (4/5)');
      expect(result.evidence.privateCount).toBe(5);
      expect(result.evidence.publicCount).toBe(4);
      expect(result.evidence.missingSubmissionIds).toHaveLength(1);
    });
  });
});