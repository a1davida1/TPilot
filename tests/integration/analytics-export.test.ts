import { beforeAll, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import jwt from 'jsonwebtoken';
import { performance } from 'node:perf_hooks';

import { GET, __clearAnalyticsExportCacheForTests } from '../../app/api/analytics/export/route';
import type { PaginatedResult, AnalyticsContentPerformanceDaily, AnalyticsAiUsageDaily } from '../../server/services/analytics-insights';

vi.mock('../../server/services/analytics-insights', async () => {
  const actual = await vi.importActual<typeof import('../../server/services/analytics-insights')>(
    '../../server/services/analytics-insights'
  );

  return {
    ...actual,
    getContentPerformancePage: vi.fn(),
    getAiUsagePage: vi.fn(),
  };
});

let getContentPerformancePageMock: MockedFunction<typeof import('../../server/services/analytics-insights')['getContentPerformancePage']>;
let getAiUsagePageMock: MockedFunction<typeof import('../../server/services/analytics-insights')['getAiUsagePage']>;

const JWT_SECRET = 'test-secret-key';

beforeAll(async () => {
  const module = await import('../../server/services/analytics-insights');
  getContentPerformancePageMock = module.getContentPerformancePage as unknown as MockedFunction<typeof module.getContentPerformancePage>;
  getAiUsagePageMock = module.getAiUsagePage as unknown as MockedFunction<typeof module.getAiUsagePage>;
});

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  vi.clearAllMocks();
  __clearAnalyticsExportCacheForTests();
});

describe('GET /api/analytics/export', () => {
  it('returns 401 when unauthenticated', async () => {
    const response = await GET(new Request('http://localhost/api/analytics/export'));
    expect(response.status).toBe(401);
  });

  it('returns paginated content performance data under 500ms', async () => {
    const mockPayload: PaginatedResult<AnalyticsContentPerformanceDaily> = {
      data: [
        {
          userId: 42,
          contentId: 1001,
          platform: 'reddit',
          subreddit: 'r/example',
          primaryTitle: 'High performing post',
          day: new Date('2025-01-01'),
          totalViews: 1500,
          uniqueViewers: 800,
          avgTimeSpent: 45,
          totalTimeSpent: 68000,
          socialViews: 900,
          likes: 120,
          comments: 45,
          shares: 30,
          engagementRate: 12.4,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
    };

    getContentPerformancePageMock.mockResolvedValue(mockPayload);

    const token = jwt.sign({ userId: 42 }, JWT_SECRET);
    const request = new Request('http://localhost/api/analytics/export?type=content&page=1&pageSize=25', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const start = performance.now();
    const response = await GET(request);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    expect(body.type).toBe('content');
  });

  it('serves cached responses without duplicate database calls', async () => {
    const payload: PaginatedResult<AnalyticsContentPerformanceDaily> = {
      data: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    };

    getContentPerformancePageMock.mockResolvedValue(payload);

    const token = jwt.sign({ userId: 77 }, JWT_SECRET);
    const request = new Request('http://localhost/api/analytics/export?type=content&page=1&pageSize=10', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const first = await GET(request);
    expect(first.status).toBe(200);
    expect(getContentPerformancePageMock).toHaveBeenCalledTimes(1);

    const second = await GET(request);
    expect(second.status).toBe(200);
    expect(getContentPerformancePageMock).toHaveBeenCalledTimes(1);
  });

  it('routes AI requests to the AI usage service', async () => {
    const aiPayload: PaginatedResult<AnalyticsAiUsageDaily> = {
      data: [],
      page: 1,
      pageSize: 5,
      total: 0,
      totalPages: 0,
    };

    getAiUsagePageMock.mockResolvedValue(aiPayload);

    const token = jwt.sign({ userId: 11 }, JWT_SECRET);
    const request = new Request('http://localhost/api/analytics/export?type=ai&page=1&pageSize=5', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(getAiUsagePageMock).toHaveBeenCalledWith(11, expect.objectContaining({ page: 1, pageSize: 5 }));
  });
});
