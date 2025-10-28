/**
 * Analytics Export API Route (Next.js App Router)
 * Provides paginated export of analytics data (content performance & AI usage)
 * Extracted from PR #38
 */

import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import LRUCache from 'lru-cache';
import { getAiUsagePage, getContentPerformancePage } from '../../../../server/services/analytics-insights';
import { auth, clearAuthRequestContext, setAuthRequestContext } from '../../_lib/auth';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  type: z.enum(['content', 'ai']).default('content'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  refresh: z.coerce.boolean().optional().default(false),
});

type QueryParams = z.infer<typeof querySchema>;

type ExportPayload = {
  data: unknown;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  type: QueryParams['type'];
  generatedAt: string;
};

type CachedPayload = {
  generatedAt: string;
  response: ExportPayload;
};

const exportCache = new LRUCache<string, CachedPayload>({
  max: 200,
  ttl: 60 * 1000,
});

function buildCacheKey(userId: number, params: QueryParams): string {
  const { page, pageSize, type, startDate, endDate } = params;
  return [
    userId,
    type,
    page,
    pageSize,
    startDate ? startDate.toISOString() : 'null',
    endDate ? endDate.toISOString() : 'null',
  ].join(':');
}

function buildResponseHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, max-age=60',
  };
}

export async function GET(request: Request) {
  try {
    setAuthRequestContext(request);
    const { userId } = auth();
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const params = querySchema.parse(raw);

    if (params.startDate && params.endDate && params.endDate < params.startDate) {
      return NextResponse.json(
        { error: 'Invalid date range: endDate must be on or after startDate.' },
        { status: 400 },
      );
    }

    const cacheKey = buildCacheKey(userId, params);
    if (!params.refresh) {
      const cached = exportCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached.response, { headers: buildResponseHeaders() });
      }
    }

    const { page, pageSize, startDate, endDate, type } = params;

    const result = type === 'content'
      ? await getContentPerformancePage(userId, { page, pageSize, startDate, endDate })
      : await getAiUsagePage(userId, { page, pageSize, startDate, endDate });

    const payload = {
      data: result.data,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      type,
      generatedAt: new Date().toISOString(),
    };

    exportCache.set(cacheKey, {
      generatedAt: payload.generatedAt,
      response: payload,
    });

    return NextResponse.json(payload, { headers: buildResponseHeaders() });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 },
      );
    }

    console.error('Analytics export failed', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  } finally {
    clearAuthRequestContext();
  }
}

export function __clearAnalyticsExportCacheForTests(): void {
  exportCache.clear();
}
