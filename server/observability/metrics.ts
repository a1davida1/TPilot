import type { Express, RequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import { API_PREFIX, prefixApiPath } from '../lib/api-prefix.js';
import { db } from '../db.js';
import { postJobs, users, userSamples } from '@shared/schema';
import { logger } from '../bootstrap/logger.js';

export interface MetricsSummary {
  creators: number;
  posts: number;
  engagement: number;
}

export interface MetricsHandlerDependencies {
  loadMetrics?: () => Promise<MetricsSummary>;
}

export async function loadMetricsSummary(): Promise<MetricsSummary> {
  const [userCountRows, postCountRows, engagementRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(postJobs),
    db
      .select({ avg: sql<number>`COALESCE(AVG(${userSamples.performanceScore}), 0)` })
      .from(userSamples)
  ]);

  const creators = userCountRows[0]?.count ?? 0;
  const posts = postCountRows[0]?.count ?? 0;
  const engagementAverage = engagementRows[0]?.avg ?? 0;
  const normalizedEngagement = Number.isFinite(engagementAverage)
    ? engagementAverage
    : 0;

  return {
    creators,
    posts,
    engagement: Math.round(normalizedEngagement)
  };
}

export function createMetricsHandler(
  dependencies: MetricsHandlerDependencies = {}
): RequestHandler {
  const { loadMetrics = loadMetricsSummary } = dependencies;

  return async (_req, res) => {
    try {
      const metrics = await loadMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to load metrics summary', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function mountMetrics(
  app: Express,
  apiPrefix: string = API_PREFIX,
  dependencies?: MetricsHandlerDependencies
): void {
  const routePath = prefixApiPath('/metrics', apiPrefix);
  app.get(routePath, createMetricsHandler(dependencies));
}
