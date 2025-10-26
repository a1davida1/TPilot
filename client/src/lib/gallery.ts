import { z } from 'zod';

export type ProtectionLevel = 'light' | 'standard' | 'heavy';

const FALLBACK_MIME = 'image/jpeg';
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
};

const isoDateInputSchema = z.union([z.string(), z.date(), z.number()]).optional().nullable();

function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  // Allow relative paths (e.g., /uploads/token) for local storage
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // For absolute URLs, validate protocol
  try {
    const normalized = new URL(trimmed);
    if (!['https:', 'http:'].includes(normalized.protocol)) {
      return undefined;
    }
    return normalized.toString();
  } catch {
    return undefined;
  }
}

function sanitizeFilename(value: unknown, fallbackId: string): string {
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\r\n]+/g, ' ').trim().slice(0, 255);
    if (cleaned) {
      return cleaned;
    }
  }
  return fallbackId;
}

function detectMime(filename: string, provided: unknown): string {
  if (typeof provided === 'string') {
    const trimmed = provided.trim().toLowerCase();
    if (/^[\w.+-]+\/[\w.+-]+$/.test(trimmed)) {
      return trimmed;
    }
  }

  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }

  return FALLBACK_MIME;
}

function normalizeVisibility(value: unknown): string {
  if (typeof value !== 'string') {
    return 'private';
  }
  const trimmed = value.trim();
  return trimmed || 'private';
}

function normalizeProtectionLevel(value: unknown): ProtectionLevel | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'light' || normalized === 'standard' || normalized === 'heavy') {
    return normalized;
  }
  return undefined;
}

function sanitizeProvider(value: unknown): string {
  if (typeof value !== 'string') {
    return 'catbox';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'catbox';
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === 'imgbox') {
    return 'imgbox';
  }
  return trimmed;
}

function coerceBoolean(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  return false;
}

export function toIsoString(value: Date | string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return new Date(0).toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? new Date(0).toISOString() : fromNumber.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

export function normalizeBytes(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed);
    }
    return 0;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value);
}

export const mediaAssetResponseSchema = z
  .object({
    id: z.number().int(),
    filename: z.unknown(),
    bytes: z.unknown(),
    mime: z.unknown(),
    visibility: z.unknown(),
    createdAt: isoDateInputSchema,
    signedUrl: z.unknown().optional(),
    downloadUrl: z.unknown().optional(),
    isProtected: z.unknown().optional(),
    protectionLevel: z.unknown().optional(),
    lastRepostedAt: isoDateInputSchema
  })
  .transform((raw) => {
    const id = raw.id;
    const filename = sanitizeFilename(raw.filename, `media-asset-${id}`);
    const protectionLevel = normalizeProtectionLevel(raw.protectionLevel);

    return {
      id,
      filename,
      bytes: normalizeBytes(raw.bytes),
      mime: detectMime(filename, raw.mime),
      visibility: normalizeVisibility(raw.visibility),
      createdAt: toIsoString(raw.createdAt ?? null),
      signedUrl: sanitizeUrl(raw.signedUrl),
      downloadUrl: sanitizeUrl(raw.downloadUrl),
      isProtected: protectionLevel ? true : coerceBoolean(raw.isProtected),
      protectionLevel,
      lastRepostedAt: raw.lastRepostedAt ? toIsoString(raw.lastRepostedAt) : undefined
    };
  });

const _mediaAssetsResponseSchema = z.array(mediaAssetResponseSchema);

export type MediaAssetResponse = z.infer<typeof mediaAssetResponseSchema>;

const catboxUploadResponseSchema = z
  .object({
    id: z.number().int(),
    url: z.unknown(),
    filename: z.unknown().optional(),
    fileSize: z.unknown().optional(),
    mime: z.unknown().optional(),
    uploadedAt: isoDateInputSchema,
    provider: z.unknown().optional()
  })
  .transform((raw) => {
    const id = raw.id;
    const url = sanitizeUrl(raw.url);
    if (!url) {
      throw new Error('Invalid Catbox upload URL');
    }

    const filename = sanitizeFilename(raw.filename, `catbox-upload-${id}`);

    return {
      id,
      url,
      filename,
      fileSize: normalizeBytes(raw.fileSize),
      mime: detectMime(filename, raw.mime),
      uploadedAt: toIsoString(raw.uploadedAt ?? null),
      provider: sanitizeProvider(raw.provider)
    };
  });

const catboxUploadsApiResponseSchema = z.object({
  uploads: z.array(catboxUploadResponseSchema)
});

export type CatboxUploadResponse = z.infer<typeof catboxUploadResponseSchema>;
export type CatboxUploadsApiResponse = z.infer<typeof catboxUploadsApiResponseSchema>;

function _parseWithSchema<T>(schema: z.ZodType<T>, input: unknown, errorMessage: string): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(errorMessage);
  }
  return parsed.data;
}

export function parseMediaAssetsResponse(input: unknown): MediaAssetResponse[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const results: MediaAssetResponse[] = [];
  for (const item of input) {
    try {
      const parsed = mediaAssetResponseSchema.parse(item);
      results.push(parsed);
    } catch {
      // Skip invalid items
    }
  }
  return results;
}

export function parseSingleMediaAsset(input: unknown): MediaAssetResponse | null {
  try {
    return mediaAssetResponseSchema.parse(input);
  } catch {
    return null;
  }
}

export function parseCatboxUploadsApiResponse(input: unknown): CatboxUploadsApiResponse {
  if (!input || typeof input !== 'object') {
    return { uploads: [] };
  }
  
  try {
    return catboxUploadsApiResponseSchema.parse(input);
  } catch {
    return { uploads: [] };
  }
}

export interface GalleryImageBase {
  id: string;
  filename: string;
  bytes: number;
  mime: string;
  createdAt: string;
  signedUrl?: string;
  downloadUrl?: string;
  isProtected?: boolean;
  protectionLevel?: ProtectionLevel;
  lastRepostedAt?: string;
}

export interface LibraryGalleryImage extends GalleryImageBase {
  origin: 'library';
  libraryId: number;
  visibility: string;
}

export interface CatboxGalleryImage extends GalleryImageBase {
  origin: 'catbox';
  catboxId: number;
  provider: string;
}

export type GalleryImage = LibraryGalleryImage | CatboxGalleryImage;

export function isLibraryImage(image: GalleryImage): image is LibraryGalleryImage {
  return image.origin === 'library';
}

export function mapMediaAssetToGalleryImage(asset: MediaAssetResponse): LibraryGalleryImage {
  return {
    id: `library-${asset.id}`,
    origin: 'library',
    libraryId: asset.id,
    filename: asset.filename,
    bytes: asset.bytes,
    mime: asset.mime,
    createdAt: asset.createdAt,
    signedUrl: asset.signedUrl,
    downloadUrl: asset.downloadUrl,
    isProtected: asset.isProtected,
    protectionLevel: asset.protectionLevel,
    lastRepostedAt: asset.lastRepostedAt,
    visibility: asset.visibility
  };
}

export function mapCatboxUploadToGalleryImage(upload: CatboxUploadResponse): CatboxGalleryImage {
  return {
    id: `catbox-${upload.id}`,
    origin: 'catbox',
    catboxId: upload.id,
    filename: upload.filename,
    bytes: upload.fileSize,
    mime: upload.mime,
    createdAt: upload.uploadedAt,
    signedUrl: upload.url,
    downloadUrl: upload.url,
    provider: upload.provider
  };
}

export function mergeGalleryImages(
  mediaAssets: MediaAssetResponse[],
  catboxUploads: CatboxUploadResponse[]
): GalleryImage[] {
  return [
    ...mediaAssets.map(mapMediaAssetToGalleryImage),
    ...catboxUploads.map(mapCatboxUploadToGalleryImage)
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getGalleryImageUrl(image: GalleryImage): string {
  if (image.signedUrl) {
    return image.signedUrl;
  }
  if (image.downloadUrl) {
    return image.downloadUrl;
  }
  return '';
}

export function formatMimeLabel(mime: string): string {
  if (!mime.includes('/')) {
    return mime.toUpperCase();
  }
  const [, subtype] = mime.split('/');
  return subtype ? subtype.toUpperCase() : mime.toUpperCase();
}
