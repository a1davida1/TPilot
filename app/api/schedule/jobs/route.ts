import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '@server/db';
import {
  scheduleJobs,
  scheduledPosts,
  type ScheduleJobStatus,
} from '@shared/schema';

import {
  listJobs,
  loadJob,
  parseStatusFilters,
  resolveSchedulingConstraints,
  sanitizeMultiline,
  sanitizeSingleLine,
  validateScheduleWindow,
  type SerializedScheduleJob,
} from '../_utils';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const mediaUrlSchema = z.string().url().max(1000);

const createScheduledPostSchema = z.object({
  title: z.string().min(4).max(300),
  caption: z.string().max(40000).optional(),
  subreddit: z.string().regex(/^[A-Za-z0-9_]{3,21}$/u, 'Invalid subreddit name'),
  mediaUrls: z.array(mediaUrlSchema).max(10).optional(),
  nsfw: z.boolean().optional(),
  spoiler: z.boolean().optional(),
  flairId: z.string().min(1).max(100).optional(),
  flairText: z.string().min(1).max(100).optional(),
  sendReplies: z.boolean().optional(),
  timezone: z.string().min(2).max(50).optional(),
});

const createJobSchema = z.object({
  jobType: z.string().min(3).max(50),
  runAt: z.string().datetime(),
  priority: z.number().int().min(-10).max(10).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  retryBackoffSeconds: z.number().int().min(10).max(3600).optional(),
  notes: z.string().max(500).optional(),
  scheduledPost: createScheduledPostSchema,
});

function sanitizeMediaUrls(urls: string[] | undefined): string[] {
  if (!urls) {
    return [];
  }

  const seen = new Set<string>();
  const normalised: string[] = [];
  for (const url of urls) {
    const clean = sanitizeSingleLine(url);
    if (clean.length === 0) {
      continue;
    }
    if (!seen.has(clean)) {
      seen.add(clean);
      normalised.push(clean);
    }
  }
  return normalised;
}

async function handleGet(request: Request, userId: number): Promise<NextResponse> {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const limitParam = url.searchParams.get('limit');

  const statuses = parseStatusFilters(statusParam);
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const jobs = await listJobs(userId, { statuses, limit });

  return NextResponse.json({ jobs });
}

async function handlePost(request: Request, userId: number): Promise<NextResponse> {
  const rawBody = await request.json();
  const validated = createJobSchema.parse(rawBody);

  const runAt = new Date(validated.runAt);
  if (Number.isNaN(runAt.getTime())) {
    return NextResponse.json(
      { error: 'Invalid scheduled time supplied.' },
      { status: 400 },
    );
  }

  const constraints = await resolveSchedulingConstraints(userId);
  const windowError = validateScheduleWindow(runAt, constraints.maxDays);
  if (windowError) {
    return NextResponse.json({ error: windowError }, { status: 403 });
  }

  const title = sanitizeSingleLine(validated.scheduledPost.title);
  const caption = validated.scheduledPost.caption
    ? sanitizeMultiline(validated.scheduledPost.caption)
    : null;
  const subreddit = validated.scheduledPost.subreddit.trim();
  const mediaUrls = sanitizeMediaUrls(validated.scheduledPost.mediaUrls);
  const notes = validated.notes ? sanitizeMultiline(validated.notes) : null;

  const maxAttempts = validated.maxAttempts ?? 5;
  const retryBackoffSeconds = validated.retryBackoffSeconds ?? 60;
  const priority = validated.priority ?? 0;

  const [scheduledPost] = await db
    .insert(scheduledPosts)
    .values({
      userId,
      title,
      content: caption,
      caption,
      subreddit,
      scheduledFor: runAt,
      timezone: validated.scheduledPost.timezone ?? 'UTC',
      status: 'pending',
      nsfw: validated.scheduledPost.nsfw ?? false,
      spoiler: validated.scheduledPost.spoiler ?? false,
      flairId: validated.scheduledPost.flairId ?? null,
      flairText: validated.scheduledPost.flairText ?? null,
      sendReplies: validated.scheduledPost.sendReplies ?? true,
      mediaUrls,
      imageUrl: mediaUrls[0] ?? null,
    })
    .returning();

  const payload: Record<string, unknown> = {
    tier: constraints.tier,
    mediaCount: mediaUrls.length,
  };

  if (notes) {
    payload.notes = notes.slice(0, 500);
  }

  const [job] = await db
    .insert(scheduleJobs)
    .values({
      userId,
      scheduledPostId: scheduledPost.id,
      jobType: validated.jobType,
      status: 'pending',
      priority,
      runAt,
      maxAttempts,
      retryBackoffSeconds,
      payload,
    })
    .returning();

  const jobWithRelations = await loadJob(userId, job.id);
  const responsePayload: SerializedScheduleJob = jobWithRelations ?? {
    id: job.id,
    jobType: job.jobType,
    status: job.status as ScheduleJobStatus,
    priority: job.priority,
    runAt: runAt.toISOString(),
    retryAt: null,
    lockedAt: null,
    lockedBy: null,
    attempts: 0,
    maxAttempts,
    retryBackoffSeconds,
    lastError: null,
    lastRunAt: null,
    payload,
    createdAt: job.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: job.updatedAt?.toISOString() ?? new Date().toISOString(),
    scheduledPost: {
      id: scheduledPost.id,
      title,
      caption,
      subreddit,
      scheduledFor: runAt.toISOString(),
      status: 'pending',
      nsfw: validated.scheduledPost.nsfw ?? false,
      flairId: validated.scheduledPost.flairId ?? null,
      flairText: validated.scheduledPost.flairText ?? null,
      sendReplies: validated.scheduledPost.sendReplies ?? true,
      mediaUrls,
    },
    attemptHistory: [],
  };

  return NextResponse.json({ job: responsePayload }, { status: 201 });
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    return await handleGet(request, userId);
  } catch (error) {
    console.error('Schedule jobs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}

export async function POST(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    return await handlePost(request, userId);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('Schedule jobs POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}

