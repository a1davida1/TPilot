import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { and, eq } from 'drizzle-orm';

import { db } from '@server/db';
import { scheduleJobs, scheduledPosts } from '@shared/schema';

import {
  loadJob,
  resolveSchedulingConstraints,
  sanitizeMultiline,
  updateJobStatusSchema,
  validateScheduleWindow,
} from '../../_utils';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../../_lib/auth';

function parseJobId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function handleGet(userId: number, jobId: number): Promise<NextResponse> {
  const job = await loadJob(userId, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

async function handlePatch(request: Request, userId: number, jobId: number): Promise<NextResponse> {
  const rawBody = await request.json();
  const validated = updateJobStatusSchema.parse(rawBody);

  const [jobRecord] = await db
    .select({
      id: scheduleJobs.id,
      userId: scheduleJobs.userId,
      status: scheduleJobs.status,
      runAt: scheduleJobs.runAt,
      payload: scheduleJobs.payload,
      scheduledPostId: scheduleJobs.scheduledPostId,
    })
    .from(scheduleJobs)
    .where(and(eq(scheduleJobs.id, jobId), eq(scheduleJobs.userId, userId)))
    .limit(1);

  if (!jobRecord) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const now = new Date();
  const reason = validated.reason ? sanitizeMultiline(validated.reason) : null;
  const payload = jobRecord.payload && typeof jobRecord.payload === 'object'
    ? { ...(jobRecord.payload as Record<string, unknown>) }
    : {};

  payload.lastActionAt = now.toISOString();
  if (reason) {
    payload.lastActionNote = reason.slice(0, 500);
  }

  switch (validated.action) {
    case 'cancel': {
      if (jobRecord.status === 'succeeded' || jobRecord.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Job is already completed and cannot be cancelled.' },
          { status: 409 },
        );
      }

      payload.lastAction = 'cancel';

      await db.transaction(async (trx) => {
        await trx
          .update(scheduleJobs)
          .set({
            status: 'cancelled',
            lockedAt: null,
            lockedBy: null,
            retryAt: null,
            lastError: reason ?? 'Cancelled by user',
            payload,
            updatedAt: now,
          })
          .where(and(eq(scheduleJobs.id, jobId), eq(scheduleJobs.userId, userId)));

        if (jobRecord.scheduledPostId) {
          await trx
            .update(scheduledPosts)
            .set({
              status: 'cancelled',
              cancelledAt: now,
              updatedAt: now,
            })
            .where(eq(scheduledPosts.id, jobRecord.scheduledPostId));
        }
      });

      break;
    }

    case 'reschedule': {
      if (!validated.runAt) {
        return NextResponse.json(
          { error: 'runAt must be provided when rescheduling a job.' },
          { status: 400 },
        );
      }

      const runAt = new Date(validated.runAt);
      if (Number.isNaN(runAt.getTime())) {
        return NextResponse.json({ error: 'Invalid runAt timestamp.' }, { status: 400 });
      }

      const constraints = await resolveSchedulingConstraints(userId);
      const windowError = validateScheduleWindow(runAt, constraints.maxDays);
      if (windowError) {
        return NextResponse.json({ error: windowError }, { status: 403 });
      }

      payload.lastScheduledFor = runAt.toISOString();
      payload.lastAction = 'reschedule';

      await db.transaction(async (trx) => {
        await trx
          .update(scheduleJobs)
          .set({
            status: 'pending',
            runAt,
            retryAt: null,
            lockedAt: null,
            lockedBy: null,
            payload,
            updatedAt: now,
          })
          .where(and(eq(scheduleJobs.id, jobId), eq(scheduleJobs.userId, userId)));

        if (jobRecord.scheduledPostId) {
          await trx
            .update(scheduledPosts)
            .set({
              status: 'pending',
              scheduledFor: runAt,
              updatedAt: now,
            })
            .where(eq(scheduledPosts.id, jobRecord.scheduledPostId));
        }
      });

      break;
    }

    case 'force-run': {
      payload.lastAction = 'force-run';
      const executionTime = new Date();

      await db.transaction(async (trx) => {
        await trx
          .update(scheduleJobs)
          .set({
            status: 'queued',
            runAt: executionTime,
            retryAt: null,
            lockedAt: null,
            lockedBy: null,
            payload,
            updatedAt: now,
          })
          .where(and(eq(scheduleJobs.id, jobId), eq(scheduleJobs.userId, userId)));

        if (jobRecord.scheduledPostId) {
          await trx
            .update(scheduledPosts)
            .set({
              status: 'pending',
              scheduledFor: executionTime,
              updatedAt: now,
            })
            .where(eq(scheduledPosts.id, jobRecord.scheduledPostId));
        }
      });

      break;
    }
    default: {
      return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    }
  }

  const job = await loadJob(userId, jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found after update' }, { status: 500 });
  }

  return NextResponse.json({ job });
}

export async function GET(request: Request, context: { params: { jobId: string } }) {
  try {
    setAuthRequestContext(request);
    const jobId = parseJobId(context.params.jobId);
    if (!jobId) {
      return NextResponse.json({ error: 'Invalid job identifier' }, { status: 400 });
    }

    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    return await handleGet(userId, jobId);
  } catch (error) {
    console.error('Schedule job GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}

export async function PATCH(request: Request, context: { params: { jobId: string } }) {
  try {
    setAuthRequestContext(request);
    const jobId = parseJobId(context.params.jobId);
    if (!jobId) {
      return NextResponse.json({ error: 'Invalid job identifier' }, { status: 400 });
    }

    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    return await handlePatch(request, userId, jobId);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('Schedule job PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    clearAuthRequestContext();
  }
}

