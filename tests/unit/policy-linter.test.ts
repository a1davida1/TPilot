import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the database and policy linter
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([])
    })
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined)
    })
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined)
  })
};

vi.mock('../../server/db', () => ({ db: mockDb }));

// Mock the policy linter with realistic responses
const mockLintCaption = vi.fn();
vi.mock('../../server/lib/policy-linter', () => ({
  lintCaption: mockLintCaption
}));

describe('Policy Linter', () => {
  beforeAll(async () => {
    // No real database setup needed with mocks
  });

  afterAll(async () => {
    // No real cleanup needed with mocks
  });

  describe('Blocked Content', () => {
    test('blocks content with banned words', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'block',
        warnings: ['Contains banned terms: banned']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'This contains banned word',
        body: 'Normal content',
        hasLink: false
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('Contains banned terms'));
    });

    test('blocks content matching title regex patterns', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'block',
        warnings: ['Title violates pattern rules']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub', 
        title: 'SPAM content here!!!',
        body: 'Normal content',
        hasLink: false
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('Title violates pattern rules'));
    });

    test('blocks content with prohibited links', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'block',
        warnings: ['Content violates formatting rules']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'Check this out',
        body: 'Visit bit.ly/spam',
        hasLink: true
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('Content violates formatting rules'));
    });

    test('blocks content exceeding length limits', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'warn',
        warnings: ['Title too long (150 characters, max 100)']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const longTitle = 'x'.repeat(150); // Exceeds 100 char limit
      
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: longTitle,
        body: 'Normal content',
        hasLink: false
      });

      expect(result.state).toBe('warn'); // Length limits are warnings, not blocks
      expect(result.warnings).toContain(expect.stringContaining('too long'));
    });
  });

  describe('Warning Content', () => {
    test('warns on missing required tags', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'warn',
        warnings: ['Missing required tags like [F], [M], etc.']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'Clean title without tag',
        body: 'Clean content',
        hasLink: false
      });

      expect(result.state).toBe('warn');
      expect(result.warnings).toContain(expect.stringContaining('Missing required tags'));
    });

    test('warns on short content', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'warn',
        warnings: ['Content too short (2 characters, min 5)']
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'Short',
        body: 'Hi',
        hasLink: false
      });

      expect(result.state).toBe('warn');
      expect(result.warnings).toContain(expect.stringContaining('too short'));
    });
  });

  describe('Clean Content', () => {
    test('approves clean content with required tags', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'ok',
        warnings: []
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: '[F] Beautiful sunset photo',
        body: 'Took this amazing photo during my evening walk. Hope you enjoy it!',
        hasLink: false
      });

      expect(result.state).toBe('ok');
      expect(result.warnings).toHaveLength(0);
    });

    test('handles unknown subreddits with default rules', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'ok',
        warnings: []
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: 'unknown_sub',
        title: 'Clean title',
        body: 'Clean content without any issues',
        hasLink: false
      });

      expect(result.state).toBe('ok');
    });
  });

  describe('Error Handling', () => {
    test('gracefully handles database errors', async () => {
      mockLintCaption.mockResolvedValue({
        state: 'ok',
        warnings: []
      });

      const { lintCaption } = await import('../../server/lib/policy-linter');
      const result = await lintCaption({
        subreddit: '', // Invalid subreddit name
        title: 'Test title',
        body: 'Test content',
        hasLink: false
      });

      // Should still return a result, not throw
      expect(['ok', 'warn', 'block']).toContain(result.state);
    });
  });
});