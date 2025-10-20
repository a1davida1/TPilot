import { and, desc, eq } from 'drizzle-orm';
import path from 'node:path';
import { db } from '../db.js';
import { catboxUploads } from '@shared/schema';
import { logger } from '../bootstrap/logger.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const FALLBACK_MIME = 'image/jpeg';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractFilenameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const decoded = decodeURIComponent(parts[parts.length - 1] ?? '').trim();
    return decoded || null;
  } catch {
    return null;
  }
}

function sanitizeFilename(
  provided: string | null | undefined,
  url: string,
  fallbackId: number
): string {
  const candidates = [provided, extractFilenameFromUrl(url), `catbox-upload-${fallbackId}`];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.replace(/[\n\r]+/g, ' ').slice(0, 255);
    if (normalized) {
      return normalized;
    }
  }

  return `catbox-upload-${fallbackId}`;
}

function guessMime(filename: string, url: string): string {
  const candidates = [filename, extractFilenameFromUrl(url) ?? ''];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const extension = path.extname(candidate).toLowerCase();
    if (extension && MIME_BY_EXTENSION[extension]) {
      return MIME_BY_EXTENSION[extension];
    }
  }

  return FALLBACK_MIME;
}

function normalizeFileSize(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value);
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export interface CatboxGalleryUpload {
  id: number;
  url: string;
  filename: string;
  fileSize: number;
  mime: string;
  uploadedAt: string;
  provider: string;
}

export async function getUserCatboxGalleryUploads(
  userId: number,
  limit: number = DEFAULT_LIMIT
): Promise<CatboxGalleryUpload[]> {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const rows = await db
      .select({
        id: catboxUploads.id,
        url: catboxUploads.url,
        filename: catboxUploads.filename,
        fileSize: catboxUploads.fileSize,
        uploadedAt: catboxUploads.uploadedAt,
        provider: catboxUploads.provider,
      })
      .from(catboxUploads)
      .where(and(eq(catboxUploads.userId, userId), eq(catboxUploads.success, true)))
      .orderBy(desc(catboxUploads.uploadedAt))
      .limit(normalizedLimit);

    const uploads: CatboxGalleryUpload[] = [];

    for (const row of rows) {
      const normalizedUrl = sanitizeUrl(row.url);
      if (!normalizedUrl) {
        continue;
      }

      const filename = sanitizeFilename(row.filename, normalizedUrl, row.id);
      const fileSize = normalizeFileSize(row.fileSize);
      const mime = guessMime(filename, normalizedUrl);
      const uploadedAt = toIsoString(row.uploadedAt);
      const provider = row.provider?.trim() || 'catbox';

      uploads.push({
        id: row.id,
        url: normalizedUrl,
        filename,
        fileSize,
        mime,
        uploadedAt,
        provider,
      });
    }

    return uploads;
  } catch (error) {
    logger.error('Failed to load Catbox gallery uploads', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return [];
  }
}
