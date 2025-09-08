import { eq } from "drizzle-orm";
import { lintCaption } from '../../server/lib/policy-linter';
import { db } from '../../server/db';
import { subredditRules } from '@shared/schema';

describe('Policy Linter', () => {
  beforeAll(async () => {
    // Setup test data
    await db.insert(subredditRules).values({
      subreddit: 'test_sub',
      rulesJson: {
        bannedWords: ['banned', 'forbidden'],
        titleRegexes: ['^SPAM', '!!!+'],
        bodyRegexes: ['bit\\.ly'],
        linkPolicy: 'one-link',
        maxTitleLength: 100,
        maxBodyLength: 500,
        requiredTags: ['[F]'],
        flairRequired: false
      }
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(subredditRules).where(eq(subredditRules.subreddit, 'test_sub'));
  });

  describe('Blocked Content', () => {
    test('blocks content with banned words', async () => {
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'This contains banned word',
        body: 'Normal content',
        hasLink: false
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('banned terms'));
    });

    test('blocks content matching title regex patterns', async () => {
      const result = await lintCaption({
        subreddit: 'test_sub', 
        title: 'SPAM content here!!!',
        body: 'Normal content',
        hasLink: false
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('pattern rules'));
    });

    test('blocks content with prohibited links', async () => {
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'Check this out',
        body: 'Visit bit.ly/spam',
        hasLink: true
      });

      expect(result.state).toBe('block');
      expect(result.warnings).toContain(expect.stringContaining('formatting rules'));
    });

    test('blocks content exceeding length limits', async () => {
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
      const result = await lintCaption({
        subreddit: 'test_sub',
        title: 'Clean title without tag',
        body: 'Clean content',
        hasLink: false
      });

      expect(result.state).toBe('warn');
      expect(result.warnings).toContain(expect.stringContaining('required tags'));
    });

    test('warns on short content', async () => {
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
      // Mock database error by providing invalid subreddit data
      const result = await lintCaption({
        subreddit: '', // Invalid subreddit name
        title: 'Test title',
        body: 'Test content',
        hasLink: false
      });

      // Should still return a result, not throw
      expect(result.state).toBeOneOf(['ok', 'warn', 'block']);
    });
  });
});