import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@server/db';
import { captionVariants, scheduledPosts } from '@shared/schema';
import { RedditManager } from '@server/lib/reddit';
import { RedditNativeUploadService } from '@server/services/reddit-native-upload';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const variantRequestSchema = z.object({
  variantId: z.number().int().positive(),
  scheduleAt: z.string().datetime().optional(),
  flairId: z.string().min(1).max(100).optional(),
  flairText: z.string().min(1).max(100).optional(),
  nsfw: z.boolean().optional(),
});

const bodySchema = z.object({
  variantRequests: z.array(variantRequestSchema).min(1).max(10),
  throttleMs: z.number().int().min(0).max(600000).optional(),
});

type VariantRow = typeof captionVariants.$inferSelect;

type RankedMetadata = {
  final?: {
    titles?: string[];
    nsfw?: boolean;
  };
};

function extractRankedMetadata(metadata: unknown): RankedMetadata | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  return metadata as RankedMetadata;
}

function deriveTitle(row: VariantRow): string {
  const ranked = extractRankedMetadata(row.rankedMetadata);
  const candidate = ranked?.final?.titles?.[0];
  const source = typeof candidate === 'string' && candidate.trim().length >= 4
    ? candidate.trim()
    : row.finalCaption;
  const trimmed = source.replace(/\s+/g, ' ').trim();
  const limited = trimmed.slice(0, 280);
  return limited.length > 0 ? limited : 'Shared via ThottoPilot';
}

function deriveNsfw(row: VariantRow, override?: boolean): boolean {
  if (typeof override === 'boolean') {
    return override;
  }
  const ranked = extractRankedMetadata(row.rankedMetadata);
  if (typeof ranked?.final?.nsfw === 'boolean') {
    return ranked.final.nsfw;
  }
  return false;
}

function parseSchedule(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid schedule timestamp');
  }
  return parsed;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const validated = bodySchema.parse(body);

    const ids = validated.variantRequests.map(entry => entry.variantId);
    const rows = await db
      .select()
      .from(captionVariants)
      .where(and(eq(captionVariants.userId, userId), inArray(captionVariants.id, ids)));

    if (rows.length !== ids.length) {
      return NextResponse.json(
        { error: 'One or more caption variants were not found for this account.' },
        { status: 404 },
      );
    }

    const rowById = new Map<number, VariantRow>();
    for (const row of rows) {
      rowById.set(row.id, row);
    }

    const redditManager = await RedditManager.forUser(userId);
    const throttleMs = validated.throttleMs ?? 2000;
    const now = Date.now();

    if (!redditManager) {
      return NextResponse.json(
        { error: 'Reddit account is not linked. Connect Reddit to post directly.' },
        { status: 400 },
      );
    }

    const results: Array<{
      variantId: number;
      mode: 'posted' | 'scheduled';
      status: 'success' | 'failed';
      message?: string;
      redditUrl?: string;
      scheduledFor?: string;
    }> = [];

    for (const requestEntry of validated.variantRequests) {
      const row = rowById.get(requestEntry.variantId);
      if (!row) {
        results.push({
          variantId: requestEntry.variantId,
          mode: 'posted',
          status: 'failed',
          message: 'Variant not found',
        });
        continue;
      }

      let scheduleDate: Date | null = null;
      try {
        scheduleDate = parseSchedule(requestEntry.scheduleAt);
      } catch {
        return NextResponse.json(
          { error: 'Invalid schedule timestamp provided.' },
          { status: 400 },
        );
      }
      if (scheduleDate && scheduleDate.getTime() <= now + 30_000) {
        return NextResponse.json(
          { error: 'Scheduled posts must be at least 30 seconds in the future.' },
          { status: 400 },
        );
      }

      if (scheduleDate) {
        const [scheduled] = await db
          .insert(scheduledPosts)
          .values({
            userId,
            title: deriveTitle(row),
            content: row.finalCaption,
            imageUrl: row.imageUrl,
            caption: row.finalCaption,
            subreddit: row.subreddit,
            scheduledFor: scheduleDate,
            timezone: 'UTC',
            status: 'pending',
            nsfw: deriveNsfw(row, requestEntry.nsfw),
            flairId: requestEntry.flairId ?? null,
            flairText: requestEntry.flairText ?? null,
            mediaUrls: [row.imageUrl],
          })
          .returning();

        results.push({
          variantId: row.id,
          mode: 'scheduled',
          status: 'success',
          scheduledFor: scheduleDate.toISOString(),
          message: `Scheduled post #${scheduled?.id ?? ''} for r/${row.subreddit}`,
        });
        continue;
      }

      const postResult = await RedditNativeUploadService.uploadAndPost({
        userId,
        subreddit: row.subreddit,
        title: deriveTitle(row),
        imageUrl: row.imageUrl,
        nsfw: deriveNsfw(row, requestEntry.nsfw),
      });

      if (postResult.success && postResult.url) {
        if (requestEntry.flairId || requestEntry.flairText) {
          const postId = postResult.url.split('/comments/')[1]?.split('/')[0];
          await redditManager.applyFlair(postId, {
            flairId: requestEntry.flairId ?? null,
            flairText: requestEntry.flairText ?? null,
          });
        }

        results.push({
          variantId: row.id,
          mode: 'posted',
          status: 'success',
          redditUrl: postResult.url,
          message: `Posted to r/${row.subreddit}`,
        });
      } else {
        results.push({
          variantId: row.id,
          mode: 'posted',
          status: 'failed',
          message: postResult.error ?? 'Unknown error while posting to Reddit',
        });
      }

      if (results.length < validated.variantRequests.length) {
        await sleep(throttleMs);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('Reddit post API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  } finally {
    clearAuthRequestContext();
  }
}
