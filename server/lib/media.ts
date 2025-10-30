import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import crypto from "crypto";
import Redis from "ioredis";
import { Readable } from 'node:stream';
import { env, config } from "./config.js";
import { db } from "../db.js";
import { mediaAssets, mediaUsages, users } from "@shared/schema";
import { eq, sum, and, sql, desc } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { buildUploadUrl } from "./uploads.js";
import { assertExists } from "../../helpers/assert";
import { logger } from '../bootstrap/logger.js';

// Check if S3 is configured
const isS3Configured = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.S3_BUCKET_MEDIA);

// S3 client configuration (only if configured)
const s3Client = isS3Configured ? (() => {
  assertExists(env.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID is required for S3 configuration');
  assertExists(env.AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY is required for S3 configuration');
  return new S3Client({
    region: env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
})() : null;

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

type MediaAssetRow = typeof mediaAssets.$inferSelect;

interface DownloadTokenPayload {
  assetId: number;
  userId: number;
  key: string;
}

interface MemoryDownloadTokenPayload extends DownloadTokenPayload {
  expiresAt: number;
}

const DOWNLOAD_TOKEN_PREFIX = 'media:download:';
let downloadRedisClient: Redis | null = null;

// Only create Redis connection if available and not using PG queue
if (env.REDIS_URL && process.env.USE_PG_QUEUE !== 'true') {
  try {
    downloadRedisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,  // Allow commands to queue while connecting
      lazyConnect: false,        // Connect immediately on startup
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 50, 2000); // Exponential backoff
      }
    });
    downloadRedisClient.on('error', () => {
      // Silently handle errors - will use memory fallback
    });
  } catch {
    downloadRedisClient = null;
  }
}

const memoryDownloadTokens = new Map<string, MemoryDownloadTokenPayload>();

export interface MediaUploadOptions {
  visibility?: 'private' | 'preview-watermarked';
  applyWatermark?: boolean;
  userId: number;
  filename: string;
}

export interface MediaAssetWithUrl {
  id: number;
  key: string;
  filename: string;
  bytes: number;
  mime: string;
  visibility: string;
  signedUrl?: string;
  downloadUrl?: string;
  downloadToken?: string;
  createdAt: Date;
}

export class MediaManager {
  

  private static getDownloadTokenKey(token: string): string {
    return `${DOWNLOAD_TOKEN_PREFIX}${token}`;
  }

  private static sanitizeLocalKey(key: string): string {
    return key.replace(/\//g, '_');
  }

  private static getDownloadTokenTTL(): number {
    return Math.max(1, config.signedUrlTTL || 900);
  }

  static usesLocalStorage(): boolean {
    return !isS3Configured;
  }

  static getLocalAssetPath(key: string): string {
    return path.join(uploadsDir, this.sanitizeLocalKey(key));
  }

  static async validateDownloadToken(token: string): Promise<DownloadTokenPayload | null> {
    if (!token) {
      return null;
    }

    if (downloadRedisClient) {
      try {
        const raw = await downloadRedisClient.get(this.getDownloadTokenKey(token));
        if (raw) {
          return JSON.parse(raw) as DownloadTokenPayload;
        }
      } catch (error) {
        logger.error('Failed to read download token from Redis:', error);
      }
    }

    const memoryEntry = memoryDownloadTokens.get(token);
    if (!memoryEntry) {
      return null;
    }

    if (memoryEntry.expiresAt <= Date.now()) {
      memoryDownloadTokens.delete(token);
      return null;
    }

    return {
      assetId: memoryEntry.assetId,
      userId: memoryEntry.userId,
      key: memoryEntry.key,
    };
  }

  private static async persistDownloadToken(token: string, payload: DownloadTokenPayload): Promise<void> {
    const ttlSeconds = this.getDownloadTokenTTL();

    if (downloadRedisClient) {
      try {
        await downloadRedisClient.setex(this.getDownloadTokenKey(token), ttlSeconds, JSON.stringify(payload));
        return;
      } catch (error) {
        logger.error('Failed to store download token in Redis:', error);
      }
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    memoryDownloadTokens.set(token, { ...payload, expiresAt });
    const timeout = setTimeout(() => {
      const entry = memoryDownloadTokens.get(token);
      if (entry && entry.expiresAt <= Date.now()) {
        memoryDownloadTokens.delete(token);
      }
    }, ttlSeconds * 1000);

    if (typeof timeout.unref === 'function') {
      timeout.unref();
    }
  }

  private static async generateLocalDownloadToken(asset: MediaAssetRow): Promise<string> {
    const token = crypto.randomUUID();
    await this.persistDownloadToken(token, {
      assetId: asset.id,
      userId: asset.userId,
      key: asset.key,
    });
    return token;
  }

  private static async buildAssetResponse(asset: MediaAssetRow): Promise<MediaAssetWithUrl> {
    const response: MediaAssetWithUrl = { ...asset };

    if (isS3Configured && s3Client) {
      const signedUrl = await this.getSignedUrl(asset.key);
      response.signedUrl = signedUrl;
      response.downloadUrl = env.S3_PUBLIC_CDN_DOMAIN
        ? `${env.S3_PUBLIC_CDN_DOMAIN}/${asset.key}`
        : undefined;
      response.thumbnailUrl = signedUrl; // Use same URL for thumbnail
    } else {
      const token = await this.generateLocalDownloadToken(asset);
      const downloadPath = buildUploadUrl(token);
      response.signedUrl = downloadPath;
      response.downloadUrl = downloadPath;
      response.downloadToken = token;
      response.thumbnailUrl = downloadPath; // Use same URL for thumbnail
    }

    return response;
  }

  static async uploadFile(
    buffer: Buffer,
    options: MediaUploadOptions
  ): Promise<MediaAssetWithUrl> {
    const { userId, filename, visibility = 'private', applyWatermark = false } = options;
    
    // Check user quota
    await this.checkUserQuota(userId, buffer.length);
    
    // Process image if needed
    let finalBuffer = buffer;
    let finalMime = this.getMimeType(filename);
    let extension = this.getFileExtension(filename);

    if (this.isImage(filename)) {
      const processed = await this.processImage(buffer, {
        applyWatermark: applyWatermark && config.watermark.enabled,
        quality: visibility === 'preview-watermarked' ? 70 : 90,
      });
      finalBuffer = processed.buffer;
      finalMime = processed.mime;
      extension = processed.extension;
    }

    // Generate unique key
    const sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    const key = `${userId}/${Date.now()}-${sha256.substring(0, 12)}.${extension}`;
    
    // Check if file already exists
    const existing = await this.findExistingAsset(sha256, userId);
    if (existing) {
      return existing;
    }
    
    // Upload to S3 or local filesystem
    if (isS3Configured && s3Client) {
      assertExists(env.S3_BUCKET_MEDIA, 'S3_BUCKET_MEDIA is required for upload');
      await s3Client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET_MEDIA,
        Key: key,
        Body: finalBuffer,
        ContentType: finalMime,
        Metadata: {
          'user-id': userId.toString(),
          'original-filename': filename,
          'visibility': visibility,
        },
      }));
    } else {
      // LEGAL COMPLIANCE ERROR: Local storage not allowed
      // All media must go through Reddit native upload (i.redd.it) or Imgbox fallback
      throw new Error('Local file storage is disabled for legal compliance. Use Reddit native upload or Imgbox fallback.');
    }
    
    // Save to database
    const [asset] = await db.insert(mediaAssets).values({
      userId,
      key,
      filename,
      bytes: finalBuffer.length,
      mime: finalMime,
      sha256,
      visibility,
    }).returning();
    
    return this.buildAssetResponse(asset);
  }
  
  static async getAsset(id: number, userId?: number): Promise<MediaAssetWithUrl | null> {
    const whereCondition = userId 
      ? and(eq(mediaAssets.id, id), eq(mediaAssets.userId, userId))
      : eq(mediaAssets.id, id);
    
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(whereCondition)
      .limit(1);
    if (!asset) return null;
    
    return this.buildAssetResponse(asset);
  }
  
  static async getUserAssets(userId: number, limit: number = 50): Promise<MediaAssetWithUrl[]> {
    const assets = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId))
      .orderBy(mediaAssets.createdAt)
      .limit(limit);
    
    return Promise.all(assets.map(async (asset) => this.buildAssetResponse(asset)));
  }
  
  static async deleteAsset(id: number, userId: number): Promise<boolean> {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.userId, userId)))
      .limit(1);
      
    if (!asset) return false;
    
    try {
      // Delete from S3 or local filesystem
      if (isS3Configured && s3Client) {
        assertExists(env.S3_BUCKET_MEDIA, 'S3_BUCKET_MEDIA is required for deletion');
        await s3Client.send(new DeleteObjectCommand({
          Bucket: env.S3_BUCKET_MEDIA,
          Key: asset.key,
        }));
      } else {
        // Delete from local filesystem
        const localPath = this.getLocalAssetPath(asset.key);
        await fs.unlink(localPath).catch(() => {});
      }
      
      // Delete from database
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
      
      return true;
    } catch (error) {
      logger.error('Failed to delete asset:', error);
      return false;
    }
  }
  
  static async getUserStorageUsage(userId: number): Promise<{ used: number; quota: number }> {
    const usageResult = await db
      .select({ totalBytes: sum(mediaAssets.bytes) })
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId));

    const used = Number(usageResult[0]?.totalBytes ?? 0);

    const [userRow] = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const tier = userRow?.tier ?? 'free';
    const quotaMap: Record<string, keyof typeof config.mediaQuotas> = {
      free: 'free',
      pro: 'pro',
      starter: 'pro',
      premium: 'premium',
    };

    const quotaKey = quotaMap[tier] ?? 'free';
    const quota = config.mediaQuotas[quotaKey];

    return { used, quota };
  }
  
  private static async checkUserQuota(userId: number, newFileSize: number) {
    const { used, quota } = await this.getUserStorageUsage(userId);
    
    if (used + newFileSize > quota) {
      throw new Error(`Storage quota exceeded. Used: ${Math.round(used / 1024 / 1024)}MB, Quota: ${Math.round(quota / 1024 / 1024)}MB`);
    }
  }
  
  static async processImage(buffer: Buffer, options: {
    applyWatermark: boolean;
    quality: number;
  }): Promise<{ buffer: Buffer; mime: string; extension: string }> {
    const image = sharp(buffer, { animated: true, pages: -1 });
    const metadata = await image.metadata();
    const sourceFormat = metadata.format ?? 'jpeg';

    let pipeline = image.resize(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (options.applyWatermark) {
      const watermarkSvg = Buffer.from(`
        <svg width="300" height="60" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="60" fill="black" opacity="0.3" rx="8"/>
          <text x="20" y="35" font-family="Arial, sans-serif" font-size="18"
                fill="white" opacity="${config.watermark.opacity}">
            🛡️ ${config.watermark.text}
          </text>
        </svg>
      `);

      pipeline = pipeline.composite([{
        input: watermarkSvg,
        gravity: 'southeast',
        blend: 'over',
      }]);
    }

    switch (sourceFormat) {
      case 'png': {
        const processedBuffer = await pipeline.png({ quality: 100 }).toBuffer();
        return { buffer: processedBuffer, mime: 'image/png', extension: 'png' };
      }
      case 'gif': {
        const processedBuffer = await pipeline.gif({ loop: 0 }).toBuffer();
        return { buffer: processedBuffer, mime: 'image/gif', extension: 'gif' };
      }
      case 'webp': {
        const processedBuffer = await pipeline.webp({ quality: options.quality }).toBuffer();
        return { buffer: processedBuffer, mime: 'image/webp', extension: 'webp' };
      }
      case 'jpeg':
      case 'jpg': {
        const processedBuffer = await pipeline.jpeg({ quality: options.quality }).toBuffer();
        return { buffer: processedBuffer, mime: 'image/jpeg', extension: 'jpg' };
      }
      default: {
        const processedBuffer = await pipeline.jpeg({ quality: options.quality }).toBuffer();
        return { buffer: processedBuffer, mime: 'image/jpeg', extension: 'jpg' };
      }
    }
  }
  
  private static async getSignedUrl(key: string): Promise<string> {
    if (!isS3Configured || !s3Client) {
      // Return local URL if S3 not configured
      return buildUploadUrl(key.replace(/\//g, '_'));
    }
    
    assertExists(env.S3_BUCKET_MEDIA, 'S3_BUCKET_MEDIA is required for signed URL');
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_MEDIA,
      Key: key,
    });
    
    return getSignedUrl(s3Client, command, { expiresIn: config.signedUrlTTL });
  }
  
  private static async findExistingAsset(sha256: string, userId: number): Promise<MediaAssetWithUrl | null> {
    const [existing] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.sha256, sha256), eq(mediaAssets.userId, userId)))
      .limit(1);
      
    if (!existing) return null;
    
    return {
      ...existing,
      signedUrl: isS3Configured
        ? await this.getSignedUrl(existing.key)
        : buildUploadUrl(existing.key.replace(/\//g, '_')),
    };
  }
  
  private static isImage(filename: string): boolean {
    const ext = this.getFileExtension(filename).toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  }
  
  private static getFileExtension(filename: string): string {
    return filename.split('.').pop() || 'bin';
  }
  
  private static getMimeType(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
  
  // Track media usage in posts/templates
  static async recordUsage(mediaId: number, usedInType: string, usedInId: string) {
    try {
      await db.insert(mediaUsages).values({
        mediaId,
        usedInType,
        usedInId,
      });
    } catch (error) {
      logger.error('Failed to record media usage:', error);
    }
  }
  
  static async getAssetUsage(mediaId: number) {
    return db
      .select()
      .from(mediaUsages)
      .where(eq(mediaUsages.mediaId, mediaId));
  }

  static async getUserAssetsPaged(userId: number, page: number, pageSize: number): Promise<MediaAssetWithUrl[]> {
    const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 50;
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const assets = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId))
      .orderBy(desc(mediaAssets.createdAt))
      .limit(normalizedPageSize)
      .offset(offset);

    return Promise.all(assets.map(async (asset) => this.buildAssetResponse(asset)));
  }

  static async getUserAssetCount(userId: number): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(mediaAssets)
      .where(eq(mediaAssets.userId, userId));
    return Number(row?.value ?? 0);
  }

  static async getLastUsageTimestamp(mediaId: number, usedInType: string): Promise<Date | null> {
    const [usage] = await db
      .select({ createdAt: mediaUsages.createdAt })
      .from(mediaUsages)
      .where(and(eq(mediaUsages.mediaId, mediaId), eq(mediaUsages.usedInType, usedInType)))
      .orderBy(desc(mediaUsages.createdAt))
      .limit(1);

    return usage?.createdAt ?? null;
  }

  static async getAssetBuffer(asset: MediaAssetRow | MediaAssetWithUrl): Promise<Buffer> {
    if (isS3Configured && s3Client) {
      assertExists(env.S3_BUCKET_MEDIA, 'S3_BUCKET_MEDIA is required for download');
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET_MEDIA,
        Key: asset.key,
      });
      const response = await s3Client.send(command);
      return this.streamToBuffer(response.Body);
    }

    const localPath = this.getLocalAssetPath(asset.key);
    return fs.readFile(localPath);
  }

  private static async streamToBuffer(streamBody: unknown): Promise<Buffer> {
    if (!streamBody) {
      throw new Error('Unable to read asset body');
    }

    if (Buffer.isBuffer(streamBody)) {
      return streamBody;
    }

    if (streamBody instanceof Uint8Array) {
      return Buffer.from(streamBody);
    }

    if (typeof (streamBody as Readable).pipe === 'function') {
      const readable = streamBody as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    const maybeArrayBuffer = streamBody as { arrayBuffer?: () => Promise<ArrayBuffer> };
    if (typeof maybeArrayBuffer.arrayBuffer === 'function') {
      const arrayBuffer = await maybeArrayBuffer.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    throw new Error('Unsupported asset body type');
  }
}