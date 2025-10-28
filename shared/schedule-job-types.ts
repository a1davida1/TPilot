import type { ScheduleJobStatus } from './schema';

export interface SerializedScheduleJobAttempt {
  id: number;
  attemptNumber: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
}

export interface SerializedScheduledPost {
  id: number;
  title: string;
  caption: string | null;
  subreddit: string;
  scheduledFor: string;
  status: ScheduleJobStatus;
  nsfw: boolean;
  flairId: string | null;
  flairText: string | null;
  sendReplies: boolean;
  mediaUrls: string[];
}

export interface SerializedScheduleJob {
  id: number;
  jobType: string;
  status: ScheduleJobStatus;
  priority: number;
  runAt: string;
  retryAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  retryBackoffSeconds: number;
  lastError: string | null;
  lastRunAt: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  scheduledPost: SerializedScheduledPost | null;
  attemptHistory: SerializedScheduleJobAttempt[];
}

