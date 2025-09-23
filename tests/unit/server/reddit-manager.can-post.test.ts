import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SafetyManager } from '../../../server/lib/safety-systems.js';

// Mock SafetyManager
vi.mock('../../../server/lib/safety-systems.js', () => ({
  SafetyManager: {
    performSafetyCheck: vi.fn(),
    recordPost: vi.fn(),
    recordPostForDuplicateDetection: vi.fn()
  }
}));

// Mock database 
vi.mock('../../../server/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([
            // Mock user data
            { id: 123, emailVerified: true }
          ]))
        }))
      }))
    }))
  }
}));

describe('RedditManager.canPostToSubreddit Safety Checks', () => {
  let mockSafetyManager: typeof SafetyManager;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockSafetyManager = SafetyManager as any;
    
    // Mock checkSubredditEligibility to always pass
    vi.doMock('../../../server/lib/reddit.js', async () => {
      const original = await vi.importActual('../../../server/lib/reddit.js') as any;
      return {
        ...original,
        RedditManager: {
          ...original.RedditManager,
          checkSubredditEligibility: vi.fn().mockResolvedValue({
            canPost: true,
            reason: undefined
          })
        }
      };
    });
  });

  it('should block posting when SafetyManager reports rate limit exceeded', async () => {
    // Mock SafetyManager to return rate limit exceeded
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: false,
      issues: ['Rate limit exceeded: 3/3 posts in 24h window'],
      warnings: [],
      rateLimit: {
        canPost: false,
        postsInWindow: 3,
        nextAvailableTime: new Date(Date.now() + 3600000) // 1 hour from now
      },
      duplicateCheck: { isDuplicate: false }
    });

    const result = await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Test Title',
      body: 'Test content',
      hasLink: false
    });

    expect(result.canPost).toBe(false);
    expect(result.reasons).toContain('Rate limit exceeded: 3/3 posts in 24h window');
    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      'Test Title',
      'Test content'
    );
  });

  it('should block posting when SafetyManager detects duplicate content', async () => {
    // Mock SafetyManager to return duplicate detected
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: false,
      issues: ['Identical content posted to r/testsubreddit on 9/22/2025'],
      warnings: [],
      rateLimit: {
        canPost: true,
        postsInWindow: 1,
        windowResetTime: new Date()
      },
      duplicateCheck: {
        isDuplicate: true,
        reason: 'Identical content posted to r/testsubreddit on 9/22/2025',
        lastPostedAt: new Date('2025-09-22'),
        subreddit: 'testsubreddit'
      }
    });

    const result = await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Duplicate Title',
      body: 'Duplicate content',
      hasLink: false
    });

    expect(result.canPost).toBe(false);
    expect(result.reasons).toContain('Identical content posted to r/testsubreddit on 9/22/2025');
    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      'Duplicate Title',
      'Duplicate content'
    );
  });

  it('should include warnings when approaching rate limits', async () => {
    // Mock SafetyManager to return approaching rate limit warning
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: true,
      issues: [],
      warnings: ['Approaching rate limit for this subreddit'],
      rateLimit: {
        canPost: true,
        postsInWindow: 2,
        windowResetTime: new Date()
      },
      duplicateCheck: { isDuplicate: false }
    });

    const result = await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Test Title',
      body: 'Test content',
      hasLink: false
    });

    expect(result.canPost).toBe(true);
    expect(result.warnings).toContain('Approaching rate limit for this subreddit');
    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      'Test Title',
      'Test content'
    );
  });

  it('should always call SafetyManager.performSafetyCheck even with missing title or body', async () => {
    // Mock SafetyManager to return success
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: true,
      issues: [],
      warnings: [],
      rateLimit: {
        canPost: true,
        postsInWindow: 0,
        windowResetTime: new Date()
      },
      duplicateCheck: { isDuplicate: false }
    });

    // Test with missing title
    await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      body: 'Test content',
      hasLink: false
    });

    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      '', // Empty title should be passed as empty string
      'Test content'
    );

    vi.clearAllMocks();

    // Test with missing body
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: true,
      issues: [],
      warnings: [],
      rateLimit: {
        canPost: true,
        postsInWindow: 0,
        windowResetTime: new Date()
      },
      duplicateCheck: { isDuplicate: false }
    });

    await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Test Title',
      hasLink: false
    });

    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      'Test Title',
      '' // Empty body should be passed as empty string
    );
  });

  it('should combine body and url content for safety checks', async () => {
    // Mock SafetyManager to return success
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: true,
      issues: [],
      warnings: [],
      rateLimit: {
        canPost: true,
        postsInWindow: 0,
        windowResetTime: new Date()
      },
      duplicateCheck: { isDuplicate: false }
    });

    await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Test Title',
      body: 'Test content',
      url: 'https://example.com',
      hasLink: true
    });

    expect(mockSafetyManager.performSafetyCheck).toHaveBeenCalledWith(
      '123',
      'testsubreddit',
      'Test Title',
      'Test content\nhttps://example.com' // Combined content
    );
  });

  it('should return descriptive reasons for multiple rule violations', async () => {
    // Mock SafetyManager with multiple issues
    mockSafetyManager.performSafetyCheck = vi.fn().mockResolvedValue({
      canPost: false,
      issues: [
        'Rate limit exceeded: 3/3 posts in 24h window',
        'Duplicate content detected'
      ],
      warnings: ['Approaching daily limit'],
      rateLimit: {
        canPost: false,
        postsInWindow: 3,
        nextAvailableTime: new Date(Date.now() + 3600000)
      },
      duplicateCheck: {
        isDuplicate: true,
        reason: 'Duplicate content detected',
        lastPostedAt: new Date(),
        subreddit: 'testsubreddit'
      }
    });

    const result = await RedditManager.canPostToSubreddit(123, 'testsubreddit', {
      title: 'Test Title',
      body: 'Test content',
      hasLink: false
    });

    expect(result.canPost).toBe(false);
    expect(result.reasons).toEqual([
      'Rate limit exceeded: 3/3 posts in 24h window',
      'Duplicate content detected'
    ]);
    expect(result.warnings).toContain('Approaching daily limit');
    expect(result.reason).toBe('Rate limit exceeded: 3/3 posts in 24h window'); // First reason
  });
});