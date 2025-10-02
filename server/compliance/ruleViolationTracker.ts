import { storage } from '../storage.js';
import { safeLog } from '../lib/logger-utils.js';
import type { RedditPostOutcome } from '@shared/schema';

export type PostOutcomeStatus = 'posted' | 'removed';

export interface PostOutcomeRecord {
  subreddit: string;
  status: PostOutcomeStatus;
  reason?: string;
  timestamp: number;
}

export interface RemovalSummary {
  total: number;
  byReason: Record<string, number>;
}

export interface PostOutcomeInput {
  status: PostOutcomeStatus;
  reason?: string;
}

const UNSPECIFIED_REASON = 'unspecified';

const toTimestamp = (value: Date | string): number => {
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const mapOutcomeToRecord = (outcome: RedditPostOutcome): PostOutcomeRecord => {
  const trimmedReason = outcome.reason?.trim();
  return {
    subreddit: outcome.subreddit,
    status: outcome.status as PostOutcomeStatus,
    reason: trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined,
    timestamp: toTimestamp(outcome.occurredAt)
  };
};

const normalizeReason = (reason: string | null | undefined): string => {
  const trimmed = reason?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNSPECIFIED_REASON;
};

export async function recordPostOutcome(
  userId: number,
  subreddit: string,
  result: PostOutcomeInput
): Promise<void> {
  const trimmedReason = result.reason?.trim();
  const normalizedSubreddit = subreddit.trim();
  const storedSubreddit = normalizedSubreddit.length > 0 ? normalizedSubreddit : subreddit;

  try {
    await storage.recordRedditPostOutcome({
      userId,
      subreddit: storedSubreddit,
      status: result.status,
      reason: trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined,
      occurredAt: new Date()
    });
  } catch (error) {
    safeLog('error', 'Failed to record reddit post outcome', {
      userId,
      subreddit: storedSubreddit,
      status: result.status,
      error: (error as Error).message
    });
    throw error;
  }
}

export async function summarizeRemovalReasons(userId: number): Promise<RemovalSummary> {
  try {
    const aggregated = await storage.getRedditPostRemovalSummary(userId);
    const byReason: Record<string, number> = {};
    let total = 0;

    for (const row of aggregated) {
      const reasonKey = normalizeReason(row.reason);
      const count = typeof row.count === 'number' ? row.count : Number(row.count ?? 0);
      if (!Number.isFinite(count)) {
        continue;
      }
      byReason[reasonKey] = (byReason[reasonKey] ?? 0) + count;
      total += count;
    }

    return {
      total,
      byReason
    };
  } catch (error) {
    safeLog('error', 'Failed to summarize reddit removal reasons', {
      userId,
      error: (error as Error).message
    });
    throw error;
  }
}

export async function getRecordedOutcomes(userId: number): Promise<PostOutcomeRecord[]> {
  try {
    const outcomes = await storage.getRedditPostOutcomes(userId);
    return outcomes.map(mapOutcomeToRecord);
  } catch (error) {
    safeLog('error', 'Failed to load reddit post outcomes', {
      userId,
      error: (error as Error).message
    });
    throw error;
  }
}

export async function clearRecordedOutcomes(userId?: number): Promise<void> {
  try {
    await storage.clearRedditPostOutcomes(userId);
  } catch (error) {
    safeLog('error', 'Failed to clear reddit post outcomes', {
      userId,
      error: (error as Error).message
    });
    throw error;
  }
}
