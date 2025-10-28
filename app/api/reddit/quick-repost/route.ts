import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

import { db } from '@server/db';
import { RedditNativeUploadService } from '@server/services/reddit-native-upload.js';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const requestSchema = z.object({
  assetId: z.number().int().positive(),
  subreddit: z.string().min(1),
  title: z.string().min(1).max(300),
  nsfw: z.boolean().optional(),
  spoiler: z.boolean().optional(),
  flairText: z.string().max(100).optional(),
});

const repostingAssets = new Set<number>();

async function fetchActivePromotionalLink(userId: number): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT url
      FROM saved_links
      WHERE user_id = ${userId}
        AND platform = 'reddit'
        AND active = true
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `);

    const rows: Array<{ url?: unknown }> = Array.isArray((result as { rows?: unknown[] }).rows)
      ? ((result as { rows: unknown[] }).rows as Array<{ url?: unknown }>)
      : (Array.isArray(result) ? (result as Array<{ url?: unknown }>) : []);

    const candidate = rows[0]?.url;
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      return null;
    }

    const normalized = candidate.trim();
    return normalized.startsWith('http://') || normalized.startsWith('https://')
      ? normalized
      : `https://${normalized}`;
  } catch (error) {
    console.warn('Failed to resolve promotional link', error);
    return null;
  }
}

function normalizeSubreddit(value: string): string {
  return value.trim().replace(/^r\//iu, '').toLowerCase();
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function applyLinkAutoInsertion(title: string, link: string | null): string {
  if (!link) {
    return title;
  }

  const normalizedLink = link.toLowerCase();
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes(normalizedLink) || lowerTitle.includes(normalizedLink.replace(/^https?:\/\//iu, ''))) {
    return title;
  }

  const separator = title.endsWith('.') ? ' ' : ' · ';
  const candidate = `${title}${separator}${link}`;
  if (candidate.length <= 300) {
    return candidate;
  }

  return title;
}

export async function POST(request: Request) {
  let assetKey: number | null = null;
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const { assetId } = parsed.data;
    assetKey = assetId;
    if (repostingAssets.has(assetId)) {
      return NextResponse.json({ error: 'Repost already in progress for this asset.' }, { status: 409 });
    }

    repostingAssets.add(assetId);

    const subreddit = normalizeSubreddit(parsed.data.subreddit);
    if (!subreddit) {
      return NextResponse.json({ error: 'Invalid subreddit' }, { status: 400 });
    }
    const baseTitle = normalizeTitle(parsed.data.title);
    const promoLink = await fetchActivePromotionalLink(userId);
    const finalTitle = applyLinkAutoInsertion(baseTitle, promoLink);

    const result = await RedditNativeUploadService.uploadAndPost({
      userId,
      assetId,
      subreddit,
      title: finalTitle,
      nsfw: parsed.data.nsfw,
      spoiler: parsed.data.spoiler,
      flairText: parsed.data.flairText,
      applyWatermark: true,
      allowImgboxFallback: true,
    });

    if (!result.success) {
      const status = result.error?.toLowerCase().includes('permission') ? 403 : 400;
      return NextResponse.json(
        {
          error: result.error ?? 'Failed to repost image',
          warnings: result.warnings ?? [],
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      repostedAt: new Date().toISOString(),
      postId: result.postId,
      url: result.url,
      redditImageUrl: result.redditImageUrl,
      warnings: result.warnings ?? [],
      title: finalTitle,
    });
  } catch (error) {
    console.error('Quick repost API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (assetKey !== null) {
      repostingAssets.delete(assetKey);
    }
    clearAuthRequestContext();
  }
}
