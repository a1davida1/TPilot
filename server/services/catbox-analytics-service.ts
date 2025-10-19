import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { catboxUploads } from '@shared/schema';
import { logger } from '../bootstrap/logger.js';
import type {
  CatboxUploadStatsResponse,
  CatboxUploadDailyStat,
  CatboxRecentUpload,
} from '@shared/catbox-analytics';

interface RecordUploadOptions {
  userId: number;
  url?: string | null;
  sourceUrl?: string | null;
  filename?: string | null;
  fileSize?: number | null;
  uploadDuration?: number | null;
  provider?: string | null;
  success?: boolean;
  errorMessage?: string | null;
}

const TIMELINE_DAYS = 14;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeString(value: string | null | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeProvider(provider: string | null | undefined): string {
  const sanitized = sanitizeString(provider, 50);
  return sanitized ?? 'catbox';
}

function normalizeNumeric(value: number | null | undefined): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

function sanitizeErrorMessage(message: string | null | undefined): string | null {
  if (!message) {
    return null;
  }

  const normalized = message.trim();
  if (!normalized) {
    return null;
  }

  const maxLength = 2000;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function resolveStoredUrl(options: RecordUploadOptions): string {
  const primary = sanitizeString(options.url, 255);
  if (primary) {
    return primary;
  }

  const candidates = [
    sanitizeString(options.sourceUrl, 255),
    sanitizeString(options.filename, 255),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return `catbox://${options.userId}/${Date.now()}`;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export class CatboxAnalyticsService {
  static async recordUpload(options: RecordUploadOptions): Promise<void> {
    try {
      await db.insert(catboxUploads).values({
        userId: options.userId,
        url: resolveStoredUrl(options),
        filename: sanitizeString(options.filename, 255),
        fileSize: normalizeNumeric(options.fileSize),
        uploadDuration: normalizeNumeric(options.uploadDuration),
        provider: sanitizeProvider(options.provider),
        success: options.success ?? true,
        errorMessage: sanitizeErrorMessage(options.errorMessage),
      });
    } catch (error) {
      logger.error('Failed to record Catbox upload analytics', {
        error,
        userId: options.userId,
        url: options.url ?? null,
        success: options.success ?? true,
      });
    }
  }

  static async getUploadStats(userId: number): Promise<CatboxUploadStatsResponse> {
    try {
      const [aggregate] = await db
        .select({
          totalUploads: sql<number>`count(*)::int`,
          totalSize: sql<number>`coalesce(sum(${catboxUploads.fileSize}), 0)::bigint`,
          successCount: sql<number>`count(case when ${catboxUploads.success} then 1 end)::int`,
          failureCount: sql<number>`count(case when not ${catboxUploads.success} then 1 end)::int`,
          averageDuration: sql<number>`coalesce(avg(${catboxUploads.uploadDuration}), 0)::float`,
        })
        .from(catboxUploads)
        .where(eq(catboxUploads.userId, userId));

      const totalSize = Number(aggregate?.totalSize ?? 0);
      const successCount = Number(aggregate?.successCount ?? 0);
      const failureCount = Number(aggregate?.failureCount ?? 0);
      const totalUploads = Number(aggregate?.totalUploads ?? successCount + failureCount);
      const averageDuration = Number(aggregate?.averageDuration ?? 0);

      const timelineStart = startOfDay(new Date());
      timelineStart.setDate(timelineStart.getDate() - (TIMELINE_DAYS - 1));

      const timelineRows = await db
        .select({
          uploadedAt: catboxUploads.uploadedAt,
          fileSize: catboxUploads.fileSize,
          success: catboxUploads.success,
        })
        .from(catboxUploads)
        .where(
          and(
            eq(catboxUploads.userId, userId),
            gte(catboxUploads.uploadedAt, timelineStart),
          ),
        )
        .orderBy(catboxUploads.uploadedAt);

      const timelineMap = new Map<string, { uploads: number; size: number; successes: number }>();

      for (const row of timelineRows) {
        if (!row.uploadedAt) {
          continue;
        }

        const dateKey = formatDay(row.uploadedAt instanceof Date ? row.uploadedAt : new Date(row.uploadedAt));
        const entry = timelineMap.get(dateKey) ?? { uploads: 0, size: 0, successes: 0 };
        entry.uploads += 1;
        entry.size += Number(row.fileSize ?? 0);
        if (row.success) {
          entry.successes += 1;
        }
        timelineMap.set(dateKey, entry);
      }

      const uploadsByDay: CatboxUploadDailyStat[] = [];
      const successByDay: number[] = [];
      const today = startOfDay(new Date());

      for (let index = 0; index < TIMELINE_DAYS; index += 1) {
        const day = new Date(timelineStart);
        day.setDate(timelineStart.getDate() + index);
        const key = formatDay(day);
        const entry = timelineMap.get(key);
        const uploads = entry?.uploads ?? 0;
        const size = entry?.size ?? 0;
        const successes = entry?.successes ?? 0;
        uploadsByDay.push({
          date: key,
          uploads,
          totalSize: size,
          successRate: uploads > 0 ? Math.round((successes / uploads) * 1000) / 10 : 0,
        });
        successByDay.push(successes);
      }

      let streakDays = 0;
      for (let index = uploadsByDay.length - 1; index >= 0; index -= 1) {
        const entry = uploadsByDay[index];
        const entryDate = new Date(entry.date);
        const successes = successByDay[index] ?? 0;
        if (successes > 0) {
          // Only count streak if dates are consecutive up to today
          if (streakDays === 0) {
            const sameDay = formatDay(entryDate) === formatDay(today);
            if (!sameDay) {
              break;
            }
          }

          streakDays += 1;
        } else if (streakDays > 0) {
          break;
        } else if (formatDay(entryDate) === formatDay(today)) {
          break;
        }
      }

      const recentUploadsRaw = await db
        .select({
          id: catboxUploads.id,
          url: catboxUploads.url,
          filename: catboxUploads.filename,
          fileSize: catboxUploads.fileSize,
          uploadedAt: catboxUploads.uploadedAt,
          success: catboxUploads.success,
          uploadDuration: catboxUploads.uploadDuration,
        })
        .from(catboxUploads)
        .where(and(eq(catboxUploads.userId, userId), eq(catboxUploads.success, true)))
        .orderBy(desc(catboxUploads.uploadedAt))
        .limit(5);

      const recentUploads: CatboxRecentUpload[] = recentUploadsRaw.map((upload) => ({
        id: upload.id,
        url: upload.url,
        filename: upload.filename ?? null,
        fileSize: typeof upload.fileSize === 'number' ? Number(upload.fileSize) : null,
        uploadedAt: toIsoString(upload.uploadedAt),
        success: Boolean(upload.success),
        uploadDuration: typeof upload.uploadDuration === 'number'
          ? Number(upload.uploadDuration)
          : null,
      }));

      return {
        totalUploads,
        successfulUploads: successCount,
        failedUploads: failureCount,
        totalSize,
        successRate: totalUploads > 0 ? Math.round((successCount / totalUploads) * 1000) / 10 : 0,
        averageDuration: Math.round(averageDuration || 0),
        uploadsByDay,
        recentUploads,
        lastUploadAt: recentUploads.length > 0 ? recentUploads[0]?.uploadedAt ?? null : null,
        streakDays,
      } satisfies CatboxUploadStatsResponse;
    } catch (error) {
      logger.error('Failed to build Catbox upload statistics', { error, userId });
      return {
        totalUploads: 0,
        successfulUploads: 0,
        failedUploads: 0,
        totalSize: 0,
        successRate: 0,
        averageDuration: 0,
        uploadsByDay: Array.from({ length: TIMELINE_DAYS }, (_, index) => {
          const day = new Date();
          day.setDate(day.getDate() - (TIMELINE_DAYS - 1 - index));
          return {
            date: formatDay(day),
            uploads: 0,
            totalSize: 0,
            successRate: 0,
          } satisfies CatboxUploadDailyStat;
        }),
        recentUploads: [],
        lastUploadAt: null,
        streakDays: 0,
      } satisfies CatboxUploadStatsResponse;
    }
  }
}
