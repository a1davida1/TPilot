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

const outcomeStore: Map<number, PostOutcomeRecord[]> = new Map();

export interface PostOutcomeInput {
  status: PostOutcomeStatus;
  reason?: string;
}

export function recordPostOutcome(userId: number, subreddit: string, result: PostOutcomeInput): void {
  const trimmedReason = result.reason?.trim();
  const entry: PostOutcomeRecord = {
    subreddit,
    status: result.status,
    reason: trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined,
    timestamp: Date.now()
  };

  const existing = outcomeStore.get(userId);
  if (existing) {
    existing.push(entry);
  } else {
    outcomeStore.set(userId, [entry]);
  }

  // TODO: Replace outcomeStore with durable persistence once compliance datastore is ready.
}

export function summarizeRemovalReasons(userId: number): RemovalSummary {
  const entries = outcomeStore.get(userId) ?? [];
  const removalReasons: Record<string, number> = {};

  for (const entry of entries) {
    if (entry.status !== 'removed') {
      continue;
    }

    const reasonKey = entry.reason ?? 'unspecified';
    removalReasons[reasonKey] = (removalReasons[reasonKey] ?? 0) + 1;
  }

  const totalRemovals = Object.values(removalReasons).reduce((sum, count) => sum + count, 0);

  return {
    total: totalRemovals,
    byReason: removalReasons
  };
}

export function getRecordedOutcomes(userId: number): PostOutcomeRecord[] {
  return outcomeStore.get(userId) ?? [];
}

export function clearRecordedOutcomes(userId?: number): void {
  if (typeof userId === 'number') {
    outcomeStore.delete(userId);
    return;
  }
  outcomeStore.clear();
}