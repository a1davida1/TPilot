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
  url: string;
  filename?: string;
  fileSize?: number;
  uploadDuration?: number;
  provider?: string;
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
        url: options.url,
        filename: options.filename ?? null,
        fileSize: typeof options.fileSize === 'number' ? Math.round(options.fileSize) : null,
        uploadDuration: typeof options.uploadDuration === 'number'
          ? Math.round(options.uploadDuration)
          : null,
        provider: options.provider ?? 'catbox',
        success: true,
      });
    } catch (error) {
      logger.error('Failed to record Catbox upload analytics', {
        error,
        userId: options.userId,
        url: options.url,
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
          averageDuration: sql<number>`coalesce(avg(${catboxUploads.uploadDuration}), 0)::float`,
        })
        .from(catboxUploads)
        .where(eq(catboxUploads.userId, userId));

      const totalUploads = Number(aggregate?.totalUploads ?? 0);
      const totalSize = Number(aggregate?.totalSize ?? 0);
      const successCount = Number(aggregate?.successCount ?? 0);
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
      }

      let streakDays = 0;
      for (let index = uploadsByDay.length - 1; index >= 0; index -= 1) {
        const entry = uploadsByDay[index];
        const entryDate = new Date(entry.date);
        if (entry.uploads > 0) {
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
        } else {
          if (formatDay(entryDate) === formatDay(today)) {
            break;
          }
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
        .where(eq(catboxUploads.userId, userId))
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
