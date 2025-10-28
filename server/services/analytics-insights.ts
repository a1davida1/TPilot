import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import { db } from '../db';
import {
  analyticsContentPerformanceDaily,
  analyticsAiUsageDaily,
  type AnalyticsContentPerformanceDaily,
  type AnalyticsAiUsageDaily,
} from '@shared/schema';

export interface PaginationOptions {
  page: number;
  pageSize: number;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContentSeriesPoint {
  day: Date;
  totalViews: number;
  avgEngagementRate: number;
}

export interface AiSeriesPoint {
  day: Date;
  generationCount: number;
}

export interface ModelBreakdownEntry {
  model: string;
  count: number;
}

export interface TopContentEntry {
  contentId: number;
  primaryTitle: string | null;
  platform: string;
  subreddit: string | null;
  totalViews: number;
  avgEngagementRate: number;
  lastDay: Date | null;
}

export interface ContentSummary {
  totalViews: number;
  uniqueViewers: number;
  avgEngagementRate: number;
  socialInteractions: number;
}

export interface AiSummary {
  totalGenerations: number;
  averagePerDay: number;
}

export interface AnalyticsDashboardData {
  contentSummary: ContentSummary;
  aiSummary: AiSummary;
  contentSeries: ContentSeriesPoint[];
  aiSeries: AiSeriesPoint[];
  modelBreakdown: ModelBreakdownEntry[];
  topContent: TopContentEntry[];
}

function buildWhereClause(
  userId: number,
  userColumn: typeof analyticsContentPerformanceDaily.userId,
  dayColumn: typeof analyticsContentPerformanceDaily.day,
  startDate?: Date,
  endDate?: Date,
): SQL<unknown> {
  const conditions: SQL<unknown>[] = [eq(userColumn, userId)];
  if (startDate) {
    conditions.push(gte(dayColumn, startDate));
  }
  if (endDate) {
    conditions.push(lte(dayColumn, endDate));
  }
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function buildAiWhereClause(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): SQL<unknown> {
  const conditions: SQL<unknown>[] = [eq(analyticsAiUsageDaily.userId, userId)];
  if (startDate) {
    conditions.push(gte(analyticsAiUsageDaily.day, startDate));
  }
  if (endDate) {
    conditions.push(lte(analyticsAiUsageDaily.day, endDate));
  }
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

export async function getContentPerformancePage(
  userId: number,
  options: PaginationOptions,
): Promise<PaginatedResult<AnalyticsContentPerformanceDaily>> {
  const { page, pageSize, startDate, endDate } = options;
  const offset = (page - 1) * pageSize;
  const where = buildWhereClause(
    userId,
    analyticsContentPerformanceDaily.userId,
    analyticsContentPerformanceDaily.day,
    startDate,
    endDate,
  );

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(analyticsContentPerformanceDaily)
      .where(where)
      .orderBy(
        desc(analyticsContentPerformanceDaily.day),
        desc(analyticsContentPerformanceDaily.totalViews),
      )
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(analyticsContentPerformanceDaily)
      .where(where),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    data: rows,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getAiUsagePage(
  userId: number,
  options: PaginationOptions,
): Promise<PaginatedResult<AnalyticsAiUsageDaily>> {
  const { page, pageSize, startDate, endDate } = options;
  const offset = (page - 1) * pageSize;
  const where = buildAiWhereClause(userId, startDate, endDate);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(analyticsAiUsageDaily)
      .where(where)
      .orderBy(desc(analyticsAiUsageDaily.day))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(analyticsAiUsageDaily)
      .where(where),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    data: rows,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getContentSeries(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): Promise<ContentSeriesPoint[]> {
  const where = buildWhereClause(
    userId,
    analyticsContentPerformanceDaily.userId,
    analyticsContentPerformanceDaily.day,
    startDate,
    endDate,
  );

  const rows = await db
    .select({
      day: analyticsContentPerformanceDaily.day,
      totalViews: sql<number>`SUM(total_views)`,
      avgEngagementRate: sql<number>`COALESCE(AVG(engagement_rate), 0)`
    })
    .from(analyticsContentPerformanceDaily)
    .where(where)
    .groupBy(analyticsContentPerformanceDaily.day)
    .orderBy(analyticsContentPerformanceDaily.day);

  return rows.map(row => ({
    day: row.day,
    totalViews: Number(row.totalViews ?? 0),
    avgEngagementRate: Number(row.avgEngagementRate ?? 0),
  }));
}

export async function getAiSeries(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): Promise<AiSeriesPoint[]> {
  const where = buildAiWhereClause(userId, startDate, endDate);

  const rows = await db
    .select({
      day: analyticsAiUsageDaily.day,
      generationCount: sql<number>`SUM(generation_count)`
    })
    .from(analyticsAiUsageDaily)
    .where(where)
    .groupBy(analyticsAiUsageDaily.day)
    .orderBy(analyticsAiUsageDaily.day);

  return rows.map(row => ({
    day: row.day,
    generationCount: Number(row.generationCount ?? 0),
  }));
}

function isModelBreakdown(value: unknown): value is Array<{ model: string; count: number }> {
  return Array.isArray(value) && value.every(entry => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { model?: unknown }).model === 'string' &&
      Number.isFinite(Number((entry as { count?: unknown }).count))
    );
  });
}

export async function getModelBreakdown(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): Promise<ModelBreakdownEntry[]> {
  const where = buildAiWhereClause(userId, startDate, endDate);

  const rows = await db
    .select({
      modelBreakdown: analyticsAiUsageDaily.modelBreakdown,
    })
    .from(analyticsAiUsageDaily)
    .where(where);

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!isModelBreakdown(row.modelBreakdown)) {
      continue;
    }
    for (const entry of row.modelBreakdown) {
      const previous = totals.get(entry.model) ?? 0;
      totals.set(entry.model, previous + Number(entry.count));
    }
  }

  return Array.from(totals.entries())
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTopContent(
  userId: number,
  limit: number,
  startDate?: Date,
  endDate?: Date,
): Promise<TopContentEntry[]> {
  const where = buildWhereClause(
    userId,
    analyticsContentPerformanceDaily.userId,
    analyticsContentPerformanceDaily.day,
    startDate,
    endDate,
  );

  const rows = await db
    .select({
      contentId: analyticsContentPerformanceDaily.contentId,
      primaryTitle: analyticsContentPerformanceDaily.primaryTitle,
      platform: analyticsContentPerformanceDaily.platform,
      subreddit: analyticsContentPerformanceDaily.subreddit,
      totalViews: sql<number>`SUM(total_views)`,
      avgEngagementRate: sql<number>`COALESCE(AVG(engagement_rate), 0)`,
      lastDay: sql<Date | null>`MAX(day)`
    })
    .from(analyticsContentPerformanceDaily)
    .where(where)
    .groupBy(
      analyticsContentPerformanceDaily.contentId,
      analyticsContentPerformanceDaily.primaryTitle,
      analyticsContentPerformanceDaily.platform,
      analyticsContentPerformanceDaily.subreddit,
    )
    .orderBy(sql`SUM(total_views) DESC`)
    .limit(limit);

  return rows.map(row => ({
    contentId: row.contentId,
    primaryTitle: row.primaryTitle,
    platform: row.platform,
    subreddit: row.subreddit,
    totalViews: Number(row.totalViews ?? 0),
    avgEngagementRate: Number(row.avgEngagementRate ?? 0),
    lastDay: row.lastDay ?? null,
  }));
}

export async function getContentSummary(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): Promise<ContentSummary> {
  const where = buildWhereClause(
    userId,
    analyticsContentPerformanceDaily.userId,
    analyticsContentPerformanceDaily.day,
    startDate,
    endDate,
  );

  const [row] = await db
    .select({
      totalViews: sql<number>`COALESCE(SUM(total_views), 0)`,
      uniqueViewers: sql<number>`COALESCE(SUM(unique_viewers), 0)`,
      avgEngagementRate: sql<number>`COALESCE(AVG(engagement_rate), 0)`,
      socialInteractions: sql<number>`COALESCE(SUM(likes + comments + shares), 0)`
    })
    .from(analyticsContentPerformanceDaily)
    .where(where);

  return {
    totalViews: Number(row?.totalViews ?? 0),
    uniqueViewers: Number(row?.uniqueViewers ?? 0),
    avgEngagementRate: Number(row?.avgEngagementRate ?? 0),
    socialInteractions: Number(row?.socialInteractions ?? 0),
  };
}

export async function getAiSummary(
  userId: number,
  startDate?: Date,
  endDate?: Date,
): Promise<AiSummary> {
  const where = buildAiWhereClause(userId, startDate, endDate);

  const [row] = await db
    .select({
      totalGenerations: sql<number>`COALESCE(SUM(generation_count), 0)`,
      activeDays: sql<number>`COUNT(DISTINCT day)`
    })
    .from(analyticsAiUsageDaily)
    .where(where);

  const totalGenerations = Number(row?.totalGenerations ?? 0);
  const activeDays = Number(row?.activeDays ?? 0) || 1;

  return {
    totalGenerations,
    averagePerDay: activeDays === 0 ? 0 : Math.round(totalGenerations / activeDays),
  };
}

export async function getAnalyticsDashboardData(
  userId: number,
  options?: { startDate?: Date; endDate?: Date; topLimit?: number },
): Promise<AnalyticsDashboardData> {
  const startDate = options?.startDate;
  const endDate = options?.endDate;
  const topLimit = options?.topLimit ?? 5;

  const [contentSummary, aiSummary, contentSeries, aiSeries, modelBreakdown, topContent] = await Promise.all([
    getContentSummary(userId, startDate, endDate),
    getAiSummary(userId, startDate, endDate),
    getContentSeries(userId, startDate, endDate),
    getAiSeries(userId, startDate, endDate),
    getModelBreakdown(userId, startDate, endDate),
    getTopContent(userId, topLimit, startDate, endDate),
  ]);

  return {
    contentSummary,
    aiSummary,
    contentSeries,
    aiSeries,
    modelBreakdown,
    topContent,
  };
}
