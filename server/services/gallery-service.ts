import sharp from 'sharp';
import { MediaManager, type MediaAssetWithUrl } from '../lib/media.js';
import { logger } from '../bootstrap/logger.js';

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 320;
const THUMBNAIL_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const PLACEHOLDER_URL = 'https://images.placeholders.dev/?width=480&height=320&text=Preview+Unavailable';
const IMAGE_MIME_PATTERN = /^image\//i;

type ThumbnailCacheEntry = {
  url: string;
  expiresAt: number;
};

const thumbnailCache = new Map<number, ThumbnailCacheEntry>();

export interface GalleryItem {
  id: number;
  filename: string;
  thumbnailUrl: string;
  sourceUrl: string;
  downloadUrl?: string;
  bytes: number;
  mime: string;
  createdAt: string;
  isWatermarked: boolean;
  lastRepostedAt?: string;
}

export interface GalleryPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
  items: GalleryItem[];
}

async function createThumbnailBuffer(asset: MediaAssetWithUrl): Promise<Buffer> {
  const buffer = await MediaManager.getAssetBuffer(asset);

  return sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();
}

async function generateThumbnailDataUrl(asset: MediaAssetWithUrl): Promise<string> {
  try {
    const thumbnailBuffer = await createThumbnailBuffer(asset);
    // Return as base64 data URL - no external hosting needed!
    const base64 = thumbnailBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    logger.warn('Failed to generate thumbnail data URL', {
      error: error instanceof Error ? error.message : String(error),
      assetId: asset.id,
    });
    // If we have the source URL from S3, return it as fallback
    return asset.signedUrl || asset.downloadUrl || PLACEHOLDER_URL;
  }
}

async function getThumbnailUrl(userId: number, asset: MediaAssetWithUrl): Promise<string> {
  if (!IMAGE_MIME_PATTERN.test(asset.mime)) {
    return PLACEHOLDER_URL;
  }

  const cached = thumbnailCache.get(asset.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  // Generate inline data URL - no external hosting required!
  const url = await generateThumbnailDataUrl(asset);
  
  // Only cache if it's not a placeholder or fallback URL
  if (url !== PLACEHOLDER_URL && url.startsWith('data:')) {
    thumbnailCache.set(asset.id, {
      url,
      expiresAt: Date.now() + THUMBNAIL_TTL_MS,
    });
  }
  
  return url;
}

export async function getGalleryPage(
  userId: number,
  page: number,
  pageSize: number
): Promise<GalleryPagination> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 20;

  const [totalItems, assets] = await Promise.all([
    MediaManager.getUserAssetCount(userId),
    MediaManager.getUserAssetsPaged(userId, normalizedPage, normalizedPageSize),
  ]);

  const items: GalleryItem[] = await Promise.all(
    assets.map(async (asset) => {
      const thumbnailUrl = await getThumbnailUrl(userId, asset);
      const lastRepostedAt = await MediaManager.getLastUsageTimestamp(asset.id, 'reddit-repost');

      return {
        id: asset.id,
        filename: asset.filename,
        thumbnailUrl,
        sourceUrl: asset.signedUrl ?? asset.downloadUrl ?? PLACEHOLDER_URL,
        downloadUrl: asset.downloadUrl ?? asset.signedUrl,
        bytes: asset.bytes,
        mime: asset.mime,
        createdAt: asset.createdAt.toISOString(),
        isWatermarked: asset.visibility !== 'private',
        lastRepostedAt: lastRepostedAt ? lastRepostedAt.toISOString() : undefined,
      };
    })
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const hasMore = normalizedPage < totalPages;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages,
    hasMore,
    items,
  };
}
