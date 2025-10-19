import sharp from 'sharp';
import { MediaManager, type MediaAssetWithUrl } from '../lib/media.js';
import { CatboxService } from '../lib/catbox-service.js';
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

async function uploadThumbnail(userId: number, asset: MediaAssetWithUrl): Promise<string> {
  try {
    const thumbnailBuffer = await createThumbnailBuffer(asset);
    const userhash = await CatboxService.getUserHash(userId);
    const uploadResult = await CatboxService.upload({
      reqtype: 'fileupload',
      file: thumbnailBuffer,
      filename: `${asset.id}-thumbnail.jpg`,
      mimeType: 'image/jpeg',
      userhash: userhash ?? undefined,
    });

    if (!uploadResult.success || !uploadResult.url) {
      throw new Error(uploadResult.error || 'Unknown Catbox upload failure');
    }

    return uploadResult.url;
  } catch (error) {
    logger.warn('Failed to upload gallery thumbnail to Catbox', {
      error: error instanceof Error ? error.message : String(error),
      assetId: asset.id,
    });
    return PLACEHOLDER_URL;
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

  const url = await uploadThumbnail(userId, asset);
  thumbnailCache.set(asset.id, {
    url,
    expiresAt: Date.now() + THUMBNAIL_TTL_MS,
  });
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
