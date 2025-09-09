import { db } from '../server/db.js';
import { subredditRules, postJobs, postRateLimits } from '../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import { env } from '../server/lib/config.js';

// Utilities supporting validateContent

export async function getSubredditRules(subreddit: string) {
  const record = await db.query.subredditRules.findFirst({
    where: eq(subredditRules.subreddit, subreddit),
  });
  return record?.rulesJson ?? { bannedDomains: [] };
}

export async function getUserRecentPosts(userId: number) {
  const posts = await db.query.postJobs.findMany({
    where: eq(postJobs.userId, userId),
    orderBy: desc(postJobs.createdAt),
    limit: 5,
  });
  return posts.map(p => `${p.titleFinal} ${p.bodyFinal}`);
}

export function calculateSimilarity(content: string, posts: string[]) {
  if (!posts.length) return 0;
  const tokens = new Set(content.toLowerCase().split(/\W+/));
  const scores = posts.map(p => {
    const pTokens = new Set(p.toLowerCase().split(/\W+/));
    const intersection = [...tokens].filter(t => pTokens.has(t));
    return intersection.length / pTokens.size;
  });
  return Math.max(...scores);
}

export async function getUserPostingStats(userId: number) {
  const limit = env.MAX_POSTS_PER_SUBREDDIT_24H;
  const now = new Date();
  const record = await db.query.postRateLimits.findFirst({
    where: eq(postRateLimits.userId, userId),
  });

  if (record) {
    const reset =
      now.getTime() - new Date(record.lastPostAt).getTime() > 24 * 60 * 60 * 1000;
    const count = reset ? 1 : record.postCount24h + 1;
    await db
      .update(postRateLimits)
      .set({ lastPostAt: now, postCount24h: count })
      .where(eq(postRateLimits.id, record.id));
    return { requests: count, allowed: limit };
  }

  await db.insert(postRateLimits).values({
    userId,
    subreddit: 'global',
    lastPostAt: now,
    postCount24h: 1,
  });

  return { requests: 1, allowed: limit };
}

export async function mlSafetyCheck(content: string) {
  const endpoint = process.env.ML_SAFETY_URL || 'https://ml.thottopilot.com';
  const res = await fetch(`${endpoint}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`ML safety service responded with ${res.status}`);
  }
  return res.json() as Promise<{ nsfw: number }>;
}

export function generateSuggestions(violations: Array<{ type: string }>) {
  if (!violations.length) return [] as string[];
  return violations.map(v => `Please avoid ${v.type}`);
}

export function detectBenignKeywords(content: string) {
  const whitelist = [/medical/i, /education/i];
  return whitelist.some(rx => rx.test(content));
}