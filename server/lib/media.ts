import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import crypto from "crypto";
import Redis from "ioredis";
import { env, config } from "./config.js";
import { db } from "../db.js";
import { mediaAssets, mediaUsages, users } from "@shared/schema";
import { eq, sum, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { buildUploadUrl } from "./uploads.js";

// Check if S3 is configured
const isS3Configured = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.S3_BUCKET_MEDIA);

// S3 client configuration (only if configured)
const s3Client = isS3Configured ? new S3Client({
  region: env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
}) : null;

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
const downloadRedisClient = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
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
        console.error('Failed to read download token from Redis:', error);
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
        console.error('Failed to store download token in Redis:', error);
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
    } else {
      const token = await this.generateLocalDownloadToken(asset);
      const downloadPath = buildUploadUrl(token);
      response.signedUrl = downloadPath;
      response.downloadUrl = downloadPath;
      response.downloadToken = token;
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
    
    if (this.isImage(filename)) {
      finalBuffer = await this.processImage(buffer, {
        applyWatermark: applyWatermark && config.watermark.enabled,
        quality: visibility === 'preview-watermarked' ? 70 : 90,
      });
      finalMime = 'image/jpeg'; // Always convert to JPEG for consistency
    }
    
    // Generate unique key
    const sha256 = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    const extension = this.getFileExtension(filename);
    const key = `${userId}/${Date.now()}-${sha256.substring(0, 12)}.${extension}`;
    
    // Check if file already exists
    const existing = await this.findExistingAsset(sha256, userId);
    if (existing) {
      return existing;
    }
    
    // Upload to S3 or local filesystem
    if (isS3Configured && s3Client) {
      await s3Client.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET_MEDIA!,
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
      // Fallback to local filesystem
      const localPath = this.getLocalAssetPath(key);
      await fs.writeFile(localPath, finalBuffer);
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
        await s3Client.send(new DeleteObjectCommand({
          Bucket: env.S3_BUCKET_MEDIA!,
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
      console.error('Failed to delete asset:', error);
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
  
  private static async processImage(buffer: Buffer, options: {
    applyWatermark: boolean;
    quality: number;
  }): Promise<Buffer> {
    let image = sharp(buffer)
      .jpeg({ quality: options.quality })
      .resize(2048, 2048, { 
        fit: 'inside',
        withoutEnlargement: true 
      });
    
    if (options.applyWatermark) {
      // Add watermark to bottom-right corner
      const watermarkSvg = Buffer.from(`
        <svg width="300" height="60" xmlns="http://www.w3.org/2000/svg">
          <rect width="300" height="60" fill="black" opacity="0.3" rx="8"/>
          <text x="20" y="35" font-family="Arial, sans-serif" font-size="18" 
                fill="white" opacity="${config.watermark.opacity}">
            🛡️ ${config.watermark.text}
          </text>
        </svg>
      `);
      
      image = image.composite([{
        input: watermarkSvg,
        gravity: 'southeast',
        blend: 'over'
      }]);
    }
    
    return image.toBuffer();
  }
  
  private static async getSignedUrl(key: string): Promise<string> {
    if (!isS3Configured || !s3Client) {
      // Return local URL if S3 not configured
      return buildUploadUrl(key.replace(/\//g, '_'));
    }
    
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET_MEDIA!,
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
      console.error('Failed to record media usage:', error);
    }
  }
  
  static async getAssetUsage(mediaId: number) {
    return db
      .select()
      .from(mediaUsages)
      .where(eq(mediaUsages.mediaId, mediaId));
  }
}