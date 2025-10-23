import { NextResponse } from 'next/server';
import { z } from 'zod';

import { evaluateRedditPostingRisk, type RiskEvaluationResult } from '../_lib/risk-evaluator';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';
import { logger } from '@server/bootstrap/logger';
import { db } from '@server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { stateStore } from '@server/services/state-store';

const CACHE_TTL_SECONDS = 60 * 60 * 24;

interface RateLimitPolicy { limit: number; windowSeconds: number; }

const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  free: { limit: 2, windowSeconds: 60 * 60 },
  starter: { limit: 4, windowSeconds: 45 * 60 },
  pro: { limit: 10, windowSeconds: 30 * 60 },
  premium: { limit: 20, windowSeconds: 15 * 60 },
  default: { limit: 5, windowSeconds: 45 * 60 },
};

const booleanParamSchema = z.string().transform((value) => value.trim().toLowerCase())
  .refine((value) => ['true', 'false', '1', '0', 'yes', 'no'].includes(value), { message: 'Must be a boolean flag' })
  .transform((value) => ['true', '1', 'yes'].includes(value));

const querySchema = z.object({ refresh: booleanParamSchema.optional(), includeHistory: booleanParamSchema.optional() });

interface RateLimitState { count: number; resetAt: number; limit: number; }
interface RateLimitResult { allowed: boolean; remaining: number; resetAt: number; limit: number; }

function resolveRatePolicy(rawTier: string | null | undefined): RateLimitPolicy {
  return RATE_LIMIT_POLICIES[rawTier?.toLowerCase() ?? 'default'] ?? RATE_LIMIT_POLICIES.default;
}

function buildCacheKey(userId: number, includeHistory: boolean): string {
  return `reddit:risk:cache:${userId}:${includeHistory ? 'extended' : 'default'}`;
}

async function consumeRateLimit(userId: number, tier: string | null | undefined): Promise<RateLimitResult> {
  const policy = resolveRatePolicy(tier);
  const key = `reddit:risk:rate:${userId}`;
  const now = Date.now();
  const existing = (await stateStore.get(key)) as RateLimitState | null;
  if (existing && now < existing.resetAt && existing.count >= policy.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit: existing.limit };
  }
  const withinWindow = existing && now < existing.resetAt;
  const nextCount = withinWindow ? (existing?.count ?? 0) + 1 : 1;
  const resetAt = withinWindow ? existing!.resetAt : now + policy.windowSeconds * 1000;
  const ttlSeconds = Math.max(Math.ceil((resetAt - now) / 1000), 1);
  const state: RateLimitState = { count: nextCount, resetAt, limit: policy.limit };
  await stateStore.set(key, state, ttlSeconds);
  return { allowed: true, remaining: Math.max(policy.limit - nextCount, 0), resetAt, limit: policy.limit };
}

function buildRateLimitPayload(result: RateLimitResult) {
  return { limit: result.limit, remaining: result.remaining, resetAt: new Date(result.resetAt).toISOString() };
}

function isValidRiskPayload(candidate: unknown): candidate is RiskEvaluationResult {
  if (typeof candidate !== 'object' || candidate === null) return false;
  return 'warnings' in candidate && 'generatedAt' in candidate && 'stats' in candidate;
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) return new Response('Unauthorized', { status: 401 });
    const url = new URL(request.url);
    const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsedQuery.success) return NextResponse.json({ error: 'Invalid request parameters', details: parsedQuery.error.flatten() }, { status: 400 });
    const includeHistory = parsedQuery.data.includeHistory ?? false;
    const refresh = parsedQuery.data.refresh ?? false;
    const [userRecord] = await db.select({ id: users.id, tier: users.tier }).from(users).where(eq(users.id, userId)).limit(1);
    if (!userRecord) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const rateLimit = await consumeRateLimit(userId, userRecord.tier);
    if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded. Try again after the reset window.', rateLimit: buildRateLimitPayload(rateLimit) }, { status: 429 });
    const cacheKey = buildCacheKey(userId, includeHistory);
    if (!refresh) {
      const cached = await stateStore.get(cacheKey);
      if (isValidRiskPayload(cached)) {
        logger.info('reddit risk warnings served from cache', { userId, warnings: cached.warnings.length });
        return NextResponse.json({ success: true, cached: true, data: cached, rateLimit: buildRateLimitPayload(rateLimit) });
      }
    }
    const result = await evaluateRedditPostingRisk({ userId, includeHistory });
    await stateStore.set(cacheKey, result, CACHE_TTL_SECONDS);
    logger.info('reddit risk warnings generated', { userId, warnings: result.warnings.length, includeHistory });
    return NextResponse.json({ success: true, cached: false, data: result, rateLimit: buildRateLimitPayload(rateLimit) });
  } catch (error) {
    logger.error('Failed to evaluate reddit risk', error instanceof Error ? { message: error.message } : undefined);
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}
