// Basic implementation for rule violation tracking

const outcomeStore = new Map();

export function recordPostOutcome(userId, subreddit, result) {
  const trimmedReason = result.reason?.trim();
  const entry = {
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
}

export function summarizeRemovalReasons(userId) {
  const entries = outcomeStore.get(userId) ?? [];
  const removalReasons = {};

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

export function getRecordedOutcomes(userId) {
  return outcomeStore.get(userId) ?? [];
}

export function clearRecordedOutcomes(userId) {
  if (typeof userId === 'number') {
    outcomeStore.delete(userId);
    return;
  }
  outcomeStore.clear();
}