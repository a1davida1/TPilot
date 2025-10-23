import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@server/db';
import { captionVariants } from '@shared/schema';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../../_lib/auth';

const querySchema = z.object({
  subreddit: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_]{3,32}$/u, 'Subreddit may only include letters, numbers, or underscores')
    .transform(value => value.trim().replace(/^r\//iu, '').toLowerCase())
    .optional(),
  imageId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const validated = querySchema.parse(Object.fromEntries(searchParams.entries()));

    const conditions = [eq(captionVariants.userId, userId)];
    if (validated.subreddit) {
      conditions.push(eq(captionVariants.subreddit, validated.subreddit));
    }
    if (validated.imageId) {
      conditions.push(eq(captionVariants.imageId, validated.imageId));
    }

    const limit = validated.limit ?? 20;

    const rows = await db
      .select()
      .from(captionVariants)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(captionVariants.createdAt))
      .limit(limit);

    const variants = rows.map(row => ({
      id: row.id,
      subreddit: row.subreddit,
      persona: row.persona ?? null,
      tones: Array.isArray(row.toneHints) ? (row.toneHints as string[]) : [],
      finalCaption: row.finalCaption,
      finalAlt: row.finalAlt ?? null,
      finalCta: row.finalCta ?? null,
      hashtags: Array.isArray(row.hashtags) ? (row.hashtags as string[]) : [],
      rankedMetadata: row.rankedMetadata ?? null,
      imageUrl: row.imageUrl,
      imageId: row.imageId ?? null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
    }));

    return NextResponse.json({ success: true, variants });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  } finally {
    clearAuthRequestContext();
  }
}
