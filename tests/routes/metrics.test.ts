import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as metricsModule from '../../server/observability/metrics.ts';
import { csrfProtectedRoutes } from '../../server/routes.ts';
import { prefixApiPath } from '../../server/lib/api-prefix.ts';

describe('Observability metrics route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds with the aggregated metrics summary at the configured prefix', async () => {
    const metricsSummary = {
      creators: 1250,
      posts: 4810,
      engagement: 72
    } satisfies Awaited<ReturnType<typeof metricsModule.loadMetricsSummary>>;

    const app = express();
    const apiPrefix = '/api/v2';
    const loadMetricsMock = vi.fn().mockResolvedValue(metricsSummary);
    metricsModule.mountMetrics(app, apiPrefix, { loadMetrics: loadMetricsMock });

    const response = await request(app).get(`${apiPrefix}/metrics`).expect(200);

    expect(response.body).toEqual(metricsSummary);
    expect(loadMetricsMock).toHaveBeenCalledTimes(1);
  });

  it('remains exempt from CSRF protection', () => {
    const metricsPath = prefixApiPath('/metrics');
    expect(csrfProtectedRoutes).not.toContain(metricsPath);
  });
});
