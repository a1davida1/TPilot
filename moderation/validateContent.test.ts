import { test, expect, beforeEach, vi } from 'vitest';
import { validateContent } from './validateContent';
import * as utils from './moderation-utils';

vi.mock('./moderation-utils');

// Create typed mocks
const mockGetSubredditRules = vi.fn();
const mockGetUserRecentPosts = vi.fn();
const mockCalculateSimilarity = vi.fn();
const mockMlSafetyCheck = vi.fn();
const mockGetUserPostingStats = vi.fn();

// Override the mocked functions
vi.mocked(utils.getSubredditRules).mockImplementation(mockGetSubredditRules);
vi.mocked(utils.getUserRecentPosts).mockImplementation(mockGetUserRecentPosts);
vi.mocked(utils.calculateSimilarity).mockImplementation(mockCalculateSimilarity);
vi.mocked(utils.mlSafetyCheck).mockImplementation(mockMlSafetyCheck);
vi.mocked(utils.getUserPostingStats).mockImplementation(mockGetUserPostingStats);

beforeEach(() => {
  vi.resetAllMocks();
});

test('blocks banned domains from subreddit rules', async () => {
  mockGetSubredditRules.mockResolvedValue({ bannedDomains: ['spam.com'] });
  const res = await validateContent('visit spam.com now', { subreddit: 'test' });
  expect(res.allowed).toBe(false);
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'banned_domain', severity: 'block' }])
  );
});

test('warns on url shorteners', async () => {
  mockGetSubredditRules.mockResolvedValue({ bannedDomains: [] });
  const res = await validateContent('check https://bit.ly/abc', {});
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'url_shortener', severity: 'warn' }])
  );
});

test('throttles repetitive content', async () => {
  mockGetUserRecentPosts.mockResolvedValue(['hello world']);
  mockCalculateSimilarity.mockReturnValue(0.9);
  const res = await validateContent('hello world', { userId: 1 });
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'repetitive_content', severity: 'throttle' }])
  );
});

test('blocks NSFW content', async () => {
  mockMlSafetyCheck.mockResolvedValue({ nsfw: 0.9 });
  const res = await validateContent('nsfw text', {});
  expect(res.allowed).toBe(false);
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'nsfw_content', severity: 'block' }])
  );
});

test('throttles rate-limit circumvention', async () => {
  mockGetUserPostingStats.mockResolvedValue({ requests: 5, allowed: 3 });
  const res = await validateContent('content', { userId: 1 });
  expect(res.violations).toEqual(
    expect.arrayContaining([{ type: 'rate_limit', severity: 'throttle' }])
  );
});