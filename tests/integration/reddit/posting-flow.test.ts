import { describe, test, expect, vi, beforeEach } from 'vitest';
import { RedditManager } from '../../../server/lib/reddit';

// Mock snoowrap
vi.mock('snoowrap', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getSubreddit: vi.fn().mockReturnValue({
        submitLink: vi.fn().mockResolvedValue({
          id: 'test_link_post_id',
          permalink: '/r/test/comments/test_link_post_id/test_title/',
        }),
        submitSelfpost: vi.fn().mockResolvedValue({
          id: 'test_text_post_id', 
          permalink: '/r/test/comments/test_text_post_id/test_title/',
        }),
      }),
      getMe: vi.fn().mockResolvedValue({
        name: 'test_user',
        id: 'test_user_id',
      }),
    })),
  };
});

describe('Reddit Integration', () => {
  let redditManager: RedditManager;

  beforeEach(() => {
    redditManager = new RedditManager('mock_access_token', 'mock_refresh_token', 1);
  });

  test('should submit a link post successfully', async () => {
    const result = await redditManager.submitPost({
      subreddit: 'test',
      title: 'Test Link Post',
      url: 'https://example.com',
      nsfw: false,
      spoiler: false,
    });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('test_link_post_id');
    expect(result.url).toBe('https://www.reddit.com/r/test/comments/test_link_post_id/test_title/');
  });

  test('should submit a text post successfully', async () => {
    const result = await redditManager.submitPost({
      subreddit: 'test',
      title: 'Test Text Post',
      body: 'This is a test text post content.',
      nsfw: false,
      spoiler: false,
    });

    expect(result.success).toBe(true);
    expect(result.postId).toBe('test_text_post_id');
    expect(result.url).toBe('https://www.reddit.com/r/test/comments/test_text_post_id/test_title/');
  });

  test('should handle submission errors gracefully', async () => {
    // Mock a submission error
    vi.mocked(redditManager.reddit.getSubreddit).mockReturnValue({
      submitLink: vi.fn().mockRejectedValue(new Error('RATELIMIT: Rate limit exceeded')),
      submitSelfpost: vi.fn().mockRejectedValue(new Error('RATELIMIT: Rate limit exceeded')),
    });

    const result = await redditManager.submitPost({
      subreddit: 'test',
      title: 'Test Post',
      url: 'https://example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited by Reddit. Please try again later.');
  });
});