import { describe, test, expect, beforeEach, vi } from 'vitest';
import { validateContent } from './validateContent';
import * as utils from './moderation-utils';

vi.mock('./moderation-utils');

beforeEach(() => {
  vi.resetAllMocks();
});

test('blocks banned domains from subreddit rules', async () => {
  utils.getSubredditRules.mockResolvedValue({ bannedDomains: ['spam.com'] });
  const res = await validateContent('visit spam.com now', { subreddit: 'test' });
  expect(res.allowed).toBe(false);
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'banned_domain', severity: 'block' }])
  );
});

test('warns on url shorteners', async () => {
  utils.getSubredditRules.mockResolvedValue({ bannedDomains: [] });
  const res = await validateContent('check https://bit.ly/abc', {});
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'url_shortener', severity: 'warn' }])
  );
});

test('throttles repetitive content', async () => {
  utils.getUserRecentPosts.mockResolvedValue(['hello world']);
  utils.calculateSimilarity.mockReturnValue(0.9);
  const res = await validateContent('hello world', { userId: 'u1' });
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'repetitive_content', severity: 'throttle' }])
  );
});

test('blocks NSFW content', async () => {
  utils.mlSafetyCheck.mockResolvedValue({ nsfw: 0.9 });
  const res = await validateContent('nsfw text', {});
  expect(res.allowed).toBe(false);
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'nsfw_content', severity: 'block' }])
  );
});

test('throttles rate-limit circumvention', async () => {
  utils.getUserPostingStats.mockResolvedValue({ requests: 5, allowed: 3 });
  const res = await validateContent('content', { userId: 'u1' });
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'rate_limit', severity: 'throttle' }])
  );
});