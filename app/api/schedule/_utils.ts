import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@server/db';
import {
  scheduleJobs,
  scheduleJobStatusSchema,
  scheduleJobStatusValues,
  scheduledPosts,
  type ScheduleJob,
  type ScheduleJobAttempt,
  type ScheduleJobStatus,
  users,
} from '@shared/schema';
import type {
  SerializedScheduleJob,
  SerializedScheduleJobAttempt,
  SerializedScheduledPost,
} from '@shared/schedule-job-types';

const SCHEDULING_WINDOW_BY_TIER: Record<string, number> = {
  pro: 7,
  premium: 30,
};

interface ScheduleJobFilters {
  statuses?: ScheduleJobStatus[];
  limit?: number;
}

interface SchedulingConstraints {
  maxDays: number;
  tier: string;
}

const CLEAN_SINGLE_LINE = /[\u0000-\u001F\u007F]+/gu;

export function sanitizeSingleLine(value: string): string {
  return value.replace(CLEAN_SINGLE_LINE, '').trim();
}

export function sanitizeMultiline(value: string): string {
  const withoutControl = value.replace(CLEAN_SINGLE_LINE, '');
  return withoutControl.replace(/\s+/gu, (segment, _offset, _full) => {
    if (segment.includes('\n')) {
      return segment.replace(/\s*\n\s*/gu, '\n');
    }
    return ' ';
  }).trim();
}

function ensureIso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

export async function resolveSchedulingConstraints(userId: number): Promise<SchedulingConstraints> {
  const [user] = await db
    .select({ tier: users.tier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User record missing while resolving scheduling constraints');
  }

  const tier = typeof user.tier === 'string' ? user.tier.toLowerCase() : 'free';
  const maxDays = SCHEDULING_WINDOW_BY_TIER[tier] ?? 0;

  return { maxDays, tier };
}

export function validateScheduleWindow(runAt: Date, maxDays: number): string | null {
  const now = new Date();
  const earliest = new Date(now.getTime() + 30_000);
  if (runAt.getTime() < earliest.getTime()) {
    return 'Scheduled time must be at least 30 seconds in the future.';
  }

  if (maxDays <= 0) {
    return 'Your current plan does not include scheduling access.';
  }

  const latest = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
  if (runAt.getTime() > latest.getTime()) {
    return `Scheduled time exceeds the ${maxDays}-day window allowed by your plan.`;
  }

  return null;
}

type JobQueryResult = ScheduleJob & {
  scheduledPost: (typeof scheduledPosts.$inferSelect) | null;
  attempts: Array<ScheduleJobAttempt>;
};

function serialiseAttempt(attempt: ScheduleJobAttempt): SerializedScheduleJobAttempt {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    startedAt: ensureIso(attempt.startedAt) ?? new Date().toISOString(),
    finishedAt: ensureIso(attempt.finishedAt),
    error: attempt.error ?? null,
    result: attempt.result ? { ...attempt.result } : null,
    createdAt: ensureIso(attempt.createdAt) ?? new Date().toISOString(),
  };
}

function serialiseScheduledPost(post: typeof scheduledPosts.$inferSelect | null): SerializedScheduledPost | null {
  if (!post) {
    return null;
  }

  const caption = post.caption ?? post.content ?? null;
  return {
    id: post.id,
    title: sanitizeSingleLine(post.title),
    caption: caption ? sanitizeMultiline(caption).slice(0, 40000) : null,
    subreddit: post.subreddit,
    scheduledFor: ensureIso(post.scheduledFor) ?? new Date().toISOString(),
    status: post.status ?? 'pending',
    nsfw: Boolean(post.nsfw),
    flairId: post.flairId ?? null,
    flairText: post.flairText ? sanitizeSingleLine(post.flairText) : null,
    sendReplies: post.sendReplies ?? true,
    mediaUrls: Array.isArray(post.mediaUrls)
      ? post.mediaUrls.filter((url): url is string => typeof url === 'string')
      : [],
  };
}

function normalisePayload(payload: ScheduleJob['payload']): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const safeKey = sanitizeSingleLine(key).replace(/[^\w.-]+/gu, '_').slice(0, 60);
    if (!safeKey) {
      continue;
    }

    if (typeof value === 'string') {
      output[safeKey] = sanitizeMultiline(value).slice(0, 500);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      output[safeKey] = value;
    } else if (Array.isArray(value)) {
      output[safeKey] = value
        .slice(0, 20)
        .map((entry) => (typeof entry === 'string' ? sanitizeMultiline(entry).slice(0, 500) : entry))
        .filter((entry) => entry !== undefined && entry !== null);
    } else if (value && typeof value === 'object') {
      output[safeKey] = normalisePayload(value as Record<string, unknown>);
    }
  }

  return output;
}

function serialiseJob(job: JobQueryResult): SerializedScheduleJob {
  return {
    id: job.id,
    jobType: job.jobType,
    status: scheduleJobStatusSchema.parse(job.status),
    priority: job.priority,
    runAt: ensureIso(job.runAt) ?? new Date().toISOString(),
    retryAt: ensureIso(job.retryAt),
    lockedAt: ensureIso(job.lockedAt),
    lockedBy: job.lockedBy ?? null,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    retryBackoffSeconds: job.retryBackoffSeconds,
    lastError: job.lastError ? sanitizeMultiline(job.lastError).slice(0, 500) : null,
    lastRunAt: ensureIso(job.lastRunAt),
    payload: normalisePayload(job.payload),
    createdAt: ensureIso(job.createdAt) ?? new Date().toISOString(),
    updatedAt: ensureIso(job.updatedAt) ?? new Date().toISOString(),
    scheduledPost: serialiseScheduledPost(job.scheduledPost),
    attemptHistory: job.attempts.map(serialiseAttempt),
  };
}

export async function loadJob(userId: number, jobId: number): Promise<SerializedScheduleJob | null> {
  const job = await db.query.scheduleJobs.findFirst({
    where: (jobs, { and: whereAnd, eq: whereEq }) => whereAnd(whereEq(jobs.userId, userId), whereEq(jobs.id, jobId)),
    columns: {
      id: true,
      userId: true,
      scheduledPostId: true,
      jobType: true,
      status: true,
      priority: true,
      runAt: true,
      retryAt: true,
      lockedAt: true,
      lockedBy: true,
      attempts: true,
      maxAttempts: true,
      retryBackoffSeconds: true,
      lastError: true,
      lastRunAt: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      scheduledPost: {
        columns: {
          id: true,
          title: true,
          content: true,
          caption: true,
          subreddit: true,
          scheduledFor: true,
          status: true,
          nsfw: true,
          flairId: true,
          flairText: true,
          sendReplies: true,
          mediaUrls: true,
        },
      },
      attempts: {
        columns: {
          id: true,
          jobId: true,
          attemptNumber: true,
          startedAt: true,
          finishedAt: true,
          error: true,
          result: true,
          createdAt: true,
        },
        orderBy: (attemptsTable, { desc: orderDesc }) => [orderDesc(attemptsTable.attemptNumber)],
        limit: 10,
      },
    },
  });

  if (!job) {
    return null;
  }

  return serialiseJob(job as JobQueryResult);
}

export async function listJobs(userId: number, filters: ScheduleJobFilters = {}): Promise<SerializedScheduleJob[]> {
  const { statuses, limit } = filters;

  const whereClauses = [eq(scheduleJobs.userId, userId)];

  if (statuses && statuses.length > 0) {
    const parsed = statuses
      .map((status) => {
        try {
          return scheduleJobStatusSchema.parse(status);
        } catch {
          return null;
        }
      })
      .filter((value): value is ScheduleJobStatus => Boolean(value));

    if (parsed.length > 0) {
      whereClauses.push(inArray(scheduleJobs.status, parsed));
    }
  }

  const jobs = await db.query.scheduleJobs.findMany({
    where: (jobsTable, operators) =>
      operators.and(
        ...whereClauses,
      ),
    columns: {
      id: true,
      userId: true,
      scheduledPostId: true,
      jobType: true,
      status: true,
      priority: true,
      runAt: true,
      retryAt: true,
      lockedAt: true,
      lockedBy: true,
      attempts: true,
      maxAttempts: true,
      retryBackoffSeconds: true,
      lastError: true,
      lastRunAt: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      scheduledPost: {
        columns: {
          id: true,
          title: true,
          content: true,
          caption: true,
          subreddit: true,
          scheduledFor: true,
          status: true,
          nsfw: true,
          flairId: true,
          flairText: true,
          sendReplies: true,
          mediaUrls: true,
        },
      },
      attempts: {
        columns: {
          id: true,
          jobId: true,
          attemptNumber: true,
          startedAt: true,
          finishedAt: true,
          error: true,
          result: true,
          createdAt: true,
        },
        orderBy: (attemptsTable, { desc: orderDesc }) => [orderDesc(attemptsTable.attemptNumber)],
        limit: 5,
      },
    },
    orderBy: (jobsTable, { asc: orderAsc, desc: orderDesc }) => [
      orderAsc(jobsTable.status),
      orderAsc(jobsTable.runAt),
      orderDesc(jobsTable.priority),
    ],
    limit: limit && limit > 0 ? Math.min(limit, 200) : 100,
  });

  return jobs.map((job) => serialiseJob(job as JobQueryResult));
}

export function parseStatusFilters(rawStatuses: string | null): ScheduleJobStatus[] | undefined {
  if (!rawStatuses) {
    return undefined;
  }

  const split = rawStatuses
    .split(',')
    .map((value) => sanitizeSingleLine(value).toLowerCase())
    .filter((value) => value.length > 0);

  const uniqueStatuses = Array.from(new Set(split));

  const statuses: ScheduleJobStatus[] = [];
  for (const candidate of uniqueStatuses) {
    if (scheduleJobStatusValues.includes(candidate as ScheduleJobStatus)) {
      statuses.push(candidate as ScheduleJobStatus);
    }
  }

  return statuses.length > 0 ? statuses : undefined;
}

export const updateJobStatusSchema = z.object({
  action: z.enum(['cancel', 'reschedule', 'force-run']),
  runAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});


export type { SerializedScheduleJob, SerializedScheduleJobAttempt, SerializedScheduledPost } from '@shared/schedule-job-types';
