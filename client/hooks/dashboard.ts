import { useInfiniteQuery, useMutation, useQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';

const galleryItemSchema = z.object({
  id: z.number(),
  filename: z.string(),
  thumbnailUrl: z.string().url(),
  sourceUrl: z.string().url(),
  downloadUrl: z.string().url().optional(),
  bytes: z.number(),
  mime: z.string(),
  createdAt: z.string(),
  isWatermarked: z.boolean(),
  lastRepostedAt: z.string().optional(),
});

const galleryResponseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
  items: z.array(galleryItemSchema),
});

const captionUsageSchema = z.object({
  used: z.number(),
  limit: z.number().nullable().optional().default(0),
  remaining: z.number().nullable().optional().default(0),
});

const riskWarningSchema = z.object({
  id: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  subreddit: z.string(),
  title: z.string(),
  message: z.string(),
  recommendedAction: z.string(),
  metadata: z
    .object({
      scheduledFor: z.string().nullable().optional(),
      cooldownHours: z.number().nullable().optional(),
      hoursSinceLastPost: z.number().nullable().optional(),
      removalReason: z.string().nullable().optional(),
      removalAt: z.string().nullable().optional(),
      ruleReference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .optional(),
});

const riskStatsSchema = z.object({
  upcomingCount: z.number(),
  flaggedSubreddits: z.number(),
  removalCount: z.number(),
  cooldownConflicts: z.number(),
});

const riskSuccessSchema = z.object({
  success: z.literal(true),
  cached: z.boolean(),
  data: z.object({
    generatedAt: z.string(),
    warnings: z.array(riskWarningSchema),
    stats: riskStatsSchema,
  }),
  rateLimit: z
    .object({
      limit: z.number(),
      remaining: z.number(),
      resetAt: z.string(),
    })
    .optional(),
});

const riskErrorSchema = z.object({
  success: z.literal(false).optional(),
  error: z.string(),
  rateLimit: z
    .object({
      limit: z.number().optional(),
      remaining: z.number().optional(),
      resetAt: z.string().optional(),
    })
    .optional(),
});

const draftVariantSchema = z.object({
  id: z.number(),
  subreddit: z.string(),
  persona: z.string().nullable().optional(),
  tones: z.array(z.string()).optional().default([]),
  finalCaption: z.string(),
  finalAlt: z.string().nullable().optional(),
  finalCta: z.string().nullable().optional(),
  hashtags: z.array(z.string()).optional().default([]),
  rankedMetadata: z.unknown().optional(),
  imageUrl: z.string().url(),
  imageId: z.number().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

const draftResponseSchema = z.object({
  success: z.boolean(),
  variants: z.array(draftVariantSchema).default([]),
});

async function fetchJson<T>(input: RequestInfo, init?: RequestInit, schema?: z.ZodType<T>): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error('Invalid JSON response');
  }

  if (!response.ok) {
    const message = (parsed as { error?: string }).error ?? response.statusText;
    throw new Error(message || 'Request failed');
  }

  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error('Response validation failed');
    }
    return result.data;
  }

  return parsed as T;
}

export interface GalleryQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: string;
  sort?: string;
}

const defaultGalleryParams: Required<Pick<GalleryQueryParams, 'page' | 'pageSize'>> = {
  page: 1,
  pageSize: 20,
};

function buildGalleryUrl(params: GalleryQueryParams): string {
  const query = new URLSearchParams();
  const merged = { ...defaultGalleryParams, ...params };
  query.set('page', String(merged.page));
  query.set('pageSize', String(merged.pageSize));
  if (merged.search) query.set('search', merged.search);
  if (merged.filter) query.set('filter', merged.filter);
  if (merged.sort) query.set('sort', merged.sort);
  return `/api/gallery?${query.toString()}`;
}

export async function fetchGallery(params: GalleryQueryParams = {}): Promise<z.infer<typeof galleryResponseSchema>> {
  const url = buildGalleryUrl(params);
  return fetchJson(url, { cache: 'no-store' }, galleryResponseSchema);
}

export const galleryQueryKey = (params: GalleryQueryParams = {}) => ['dashboard', 'gallery', params] as const;

export function useGalleryInfiniteQuery(
  params: GalleryQueryParams,
  initialData?: z.infer<typeof galleryResponseSchema>,
) {
  return useInfiniteQuery({
    queryKey: galleryQueryKey(params),
    initialPageParam: params.page ?? defaultGalleryParams.page,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialData: initialData
      ? ({
          pages: [initialData],
          pageParams: [params.page ?? defaultGalleryParams.page],
        } satisfies InfiniteData<z.infer<typeof galleryResponseSchema>>)
      : undefined,
    queryFn: async ({ pageParam }) => fetchGallery({ ...params, page: Number(pageParam) }),
  });
}

export async function prefetchGallery(queryClient: QueryClient, params: GalleryQueryParams = {}) {
  await queryClient.prefetchInfiniteQuery({
    queryKey: galleryQueryKey(params),
    initialPageParam: params.page ?? defaultGalleryParams.page,
    queryFn: async ({ pageParam }) => fetchGallery({ ...params, page: Number(pageParam) }),
  });
}

export function useCaptionUsageSummary() {
  return useQuery({
    queryKey: ['dashboard', 'caption-usage'],
    queryFn: async () => fetchJson('/api/generations/stats', { cache: 'no-store' }, captionUsageSchema),
    staleTime: 5 * 60_000,
  });
}

export function useScheduleSignal() {
  return useQuery({
    queryKey: ['dashboard', 'schedule-signal'],
    queryFn: async () => {
      const result = await fetchJson<unknown>('/api/reddit/risk', { cache: 'no-store' });
      if (riskSuccessSchema.safeParse(result).success) {
        const parsed = riskSuccessSchema.parse(result);
        return {
          hasAlerts: parsed.data.warnings.length > 0,
          generatedAt: parsed.data.generatedAt,
          cached: parsed.cached,
        };
      }
      const errorParsed = riskErrorSchema.safeParse(result);
      if (errorParsed.success) {
        return {
          hasAlerts: true,
          error: errorParsed.data.error,
        } as const;
      }
      return { hasAlerts: false };
    },
    staleTime: 2 * 60_000,
  });
}

export function useRiskAssessment(options?: { enabled?: boolean; initialData?: z.infer<typeof riskSuccessSchema> }) {
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ['dashboard', 'risk-assessment'],
    queryFn: async () => fetchJson('/api/reddit/risk', { cache: 'no-store' }, riskSuccessSchema),
    enabled,
    staleTime: 60_000,
    initialData: options?.initialData,
  });
}

export function useCaptionDrafts() {
  return useQuery({
    queryKey: ['dashboard', 'caption-drafts'],
    queryFn: async () => fetchJson('/api/ai/generate/variants', { cache: 'no-store' }, draftResponseSchema),
    select: (data) => data.variants,
    staleTime: 2 * 60_000,
  });
}

export function useGenerateCaptionMutation() {
  return useMutation(async (payload: Record<string, unknown>) => {
    return fetchJson<unknown>('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });
}

export function usePostToRedditMutation() {
  return useMutation(async (payload: Record<string, unknown>) => {
    return fetchJson<unknown>('/api/reddit/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });
}
